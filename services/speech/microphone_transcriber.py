import argparse
import json
import queue
import sys
import tempfile
import threading
import time
import wave
from pathlib import Path

import numpy as np
import soundcard as sc
import sounddevice as sd
from faster_whisper import WhisperModel


CHANNELS = 1
SYSTEM_AUDIO_BLOCK_SECONDS = 0.25
LIVE_TRANSCRIPTION_CHUNK_SECONDS = 1.5


def emit(payload: dict) -> None:
    print(json.dumps(payload), flush=True)


def write_wav(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    clipped = np.clip(normalize_for_transcription(audio), -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())


def normalize_for_transcription(audio: np.ndarray) -> np.ndarray:
    """Lift quiet captured system audio without changing already healthy recordings."""
    if not audio.size:
        return audio

    reference_level = float(np.percentile(np.abs(audio), 99.5))

    if reference_level < 0.000001 or reference_level >= 0.18:
        return audio

    return audio * min(40.0, 0.35 / reference_level)


def transcribe_audio(model: WhisperModel, audio: np.ndarray, language: str | None, sample_rate: int) -> str:
    if audio.size < sample_rate // 2:
        return ""

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        wav_path = Path(temp_file.name)

    try:
        write_wav(wav_path, audio, sample_rate)
        segments, _info = model.transcribe(
            str(wav_path),
            language=language,
            beam_size=1,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()
    finally:
        wav_path.unlink(missing_ok=True)


def read_stdin(stop_event: threading.Event) -> None:
    for line in sys.stdin:
        if line.strip().lower() == "stop":
            stop_event.set()
            return


def choose_loopback_microphone():
    default_speaker = sc.default_speaker()
    loopbacks = [microphone for microphone in sc.all_microphones(include_loopback=True) if microphone.isloopback]

    for loopback in loopbacks:
        if default_speaker.name in loopback.name or loopback.name in default_speaker.name:
            return loopback

    return loopbacks[0] if loopbacks else None


def choose_input_device(source: str, requested_device: str) -> int | str | None:
    if requested_device:
        try:
            return int(requested_device)
        except ValueError:
            return requested_device

    if source == "system-audio":
        return choose_system_audio_device()

    return choose_microphone_device()


def choose_microphone_device() -> int | str | None:
    host_apis = sd.query_hostapis()
    devices = sd.query_devices()
    candidates: list[int] = []

    for preferred_host in ("Windows WASAPI", "Windows DirectSound", "MME", "Windows WDM-KS"):
        for host_index, host_api in enumerate(host_apis):
            if host_api["name"] != preferred_host:
                continue

            default_input = host_api.get("default_input_device", -1)
            if isinstance(default_input, int) and default_input >= 0:
                candidates.append(default_input)

            for device_index in host_api.get("devices", []):
                if devices[device_index].get("max_input_channels", 0) > 0:
                    candidates.append(device_index)

    unique_candidates = list(dict.fromkeys(candidates))
    non_stereo_mix_candidates = [
        device_index
        for device_index in unique_candidates
        if "stereo mix" not in str(devices[device_index].get("name", "")).lower()
    ]

    for device_index in [*non_stereo_mix_candidates, *unique_candidates]:
        if can_open_device(device_index):
            return device_index

    return None


def choose_system_audio_device() -> int | str | None:
    host_apis = sd.query_hostapis()
    devices = sd.query_devices()
    candidates: list[int] = []

    for preferred_host in ("Windows WASAPI", "Windows DirectSound", "MME", "Windows WDM-KS"):
        for host_index, host_api in enumerate(host_apis):
            if host_api["name"] != preferred_host:
                continue

            for device_index in host_api.get("devices", []):
                device_name = str(devices[device_index].get("name", "")).lower()
                if "stereo mix" in device_name and devices[device_index].get("max_input_channels", 0) > 0:
                    candidates.append(device_index)

    # Do not preflight Stereo Mix. Windows may reject a short probe while still
    # allowing the long-lived capture stream that follows.
    return next(iter(dict.fromkeys(candidates)), None)


def can_open_device(device_index: int) -> bool:
    sample_rate = get_device_sample_rate(device_index)

    try:
        stream = sd.InputStream(
            samplerate=sample_rate,
            channels=CHANNELS,
            dtype="float32",
            device=device_index,
            callback=lambda *_args: None,
        )
        stream.start()
        stream.stop()
        stream.close()
        return True
    except Exception:
        return False


def get_device_sample_rate(device: int | str | None) -> int:
    try:
        device_info = sd.query_devices(device, "input")
        return int(device_info.get("default_samplerate") or 48000)
    except Exception:
        return 48000


def capture_system_audio_loopback(
    audio_queue: queue.Queue[np.ndarray],
    stop_event: threading.Event,
    sample_rate: int,
) -> bool:
    loopback = choose_loopback_microphone()

    if loopback is None:
        emit(
            {
                "type": "status",
                "message": "No Windows loopback device found. Falling back to Stereo Mix.",
            }
        )
        return False

    block_frames = int(sample_rate * SYSTEM_AUDIO_BLOCK_SECONDS)
    emit({"type": "status", "message": f"Listening to system audio from {loopback.name} at {sample_rate} Hz..."})

    try:
        with loopback.recorder(samplerate=sample_rate, channels=CHANNELS, blocksize=block_frames) as recorder:
            while not stop_event.is_set():
                audio = recorder.record(numframes=block_frames)
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                audio_queue.put(audio.astype(np.float32, copy=False))
        return True
    except Exception as error:
        emit(
            {
                "type": "status",
                "message": f"Windows loopback capture failed: {error}. Falling back to Stereo Mix.",
            }
        )
        return False


def capture_system_audio(
    device: int | str | None,
    audio_queue: queue.Queue[np.ndarray],
    stop_event: threading.Event,
    sample_rate: int,
) -> int:
    if capture_system_audio_loopback(audio_queue, stop_event, sample_rate):
        return 0

    if device is None:
        emit({"type": "error", "message": "System audio capture is unavailable. Choose Microphone as the source."})
        return 4

    return capture_sounddevice_input("system-audio", device, audio_queue, stop_event, get_device_sample_rate(device))


def capture_sounddevice_input(
    source: str,
    device: int | str | None,
    audio_queue: queue.Queue[np.ndarray],
    stop_event: threading.Event,
    sample_rate: int,
) -> int:
    def callback(indata, frames, time_info, status) -> None:
        del frames, time_info
        if status:
            emit({"type": "status", "message": str(status)})
        audio_queue.put(indata[:, 0].copy())

    emit(
        {
            "type": "status",
            "message": (
                f"Listening to {source} with device "
                f"{device if device is not None else 'default'} at {sample_rate} Hz..."
            ),
        }
    )

    try:
        with sd.InputStream(
            samplerate=sample_rate,
            channels=CHANNELS,
            dtype="float32",
            device=device,
            callback=callback,
        ):
            while not stop_event.is_set():
                stop_event.wait(0.2)
        return 0
    except Exception as error:
        emit({"type": "error", "message": f"{source.title()} transcription failed: {error}"})
        return 3


def main() -> int:
    parser = argparse.ArgumentParser(description="Audio transcription sidecar.")
    parser.add_argument("--model", default="Systran/faster-whisper-tiny.en")
    parser.add_argument("--language", default="en")
    parser.add_argument("--device", default="")
    parser.add_argument("--source", choices=["microphone", "system-audio"], default="microphone")
    parser.add_argument(
        "--chunk-seconds",
        type=float,
        default=LIVE_TRANSCRIPTION_CHUNK_SECONDS,
        help="Seconds of audio to process for each live transcript update.",
    )
    args = parser.parse_args()

    stop_event = threading.Event()
    audio_queue: queue.Queue[np.ndarray] = queue.Queue()

    try:
        emit({"type": "status", "message": "Loading speech model..."})
        model = WhisperModel(args.model, device="cpu", compute_type="int8", local_files_only=True)
    except Exception as error:
        emit(
            {
                "type": "error",
                "message": (
                    f"Speech model is not available locally: {args.model}. "
                    "Download it explicitly before starting transcription."
                ),
                "detail": str(error),
            }
        )
        return 2

    stdin_thread = threading.Thread(target=read_stdin, args=(stop_event,), daemon=True)
    stdin_thread.start()

    full_audio: list[np.ndarray] = []
    partial_audio: list[np.ndarray] = []
    partial_sample_count = 0
    last_level_emit_at = 0.0
    device = choose_input_device(args.source, args.device)
    if device is None and args.source == "system-audio":
        emit(
            {
                "type": "error",
                "message": "System audio capture is unavailable. Choose Microphone as the source.",
            }
        )
        return 4

    sample_rate = 48000 if args.source == "system-audio" and not args.device else get_device_sample_rate(device)
    chunk_sample_target = int(sample_rate * args.chunk_seconds)
    language = args.language or None

    if args.source == "system-audio" and not args.device:
        capture_thread = threading.Thread(
            target=capture_system_audio,
            args=(device, audio_queue, stop_event, sample_rate),
            daemon=True,
        )
        capture_thread.start()
    else:
        capture_thread = threading.Thread(
            target=capture_sounddevice_input,
            args=(args.source, device, audio_queue, stop_event, sample_rate),
            daemon=True,
        )
        capture_thread.start()

    while capture_thread.is_alive() or not audio_queue.empty():
        try:
            chunk = audio_queue.get(timeout=0.2)
        except queue.Empty:
            continue

        full_audio.append(chunk)
        partial_audio.append(chunk)
        partial_sample_count += chunk.size

        now = time.monotonic()
        if now - last_level_emit_at >= 0.75:
            emit({"type": "level", "level": float(np.mean(np.abs(chunk)))})
            last_level_emit_at = now

        if partial_sample_count >= chunk_sample_target:
            text = transcribe_audio(model, np.concatenate(partial_audio), language, sample_rate)
            if text:
                emit({"type": "partial", "text": text})
            partial_audio = []
            partial_sample_count = 0

    capture_thread.join(timeout=1)

    emit({"type": "status", "message": "Transcribing final audio..."})

    if not full_audio:
        emit({"type": "final", "text": ""})
        return 0

    final_text = transcribe_audio(model, np.concatenate(full_audio), language, sample_rate)
    emit({"type": "final", "text": final_text})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
