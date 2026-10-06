import argparse
import json

from huggingface_hub import snapshot_download


def main() -> int:
    parser = argparse.ArgumentParser(description="Download a faster-whisper model explicitly.")
    parser.add_argument("--model", default="Systran/faster-whisper-tiny.en")
    args = parser.parse_args()

    path = snapshot_download(repo_id=args.model)
    print(json.dumps({"ok": True, "model": args.model, "path": path}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
