import json
import sys


def main() -> int:
    version = {
        "major": sys.version_info.major,
        "minor": sys.version_info.minor,
        "micro": sys.version_info.micro,
    }
    supported = version["major"] == 3 and version["minor"] in {11, 12}

    print(
        json.dumps(
            {
                "ok": supported,
                "python": sys.executable,
                "version": f"{version['major']}.{version['minor']}.{version['micro']}",
                "message": "Python version is suitable for the speech sidecar."
                if supported
                else "Use Python 3.11 or 3.12 for the speech sidecar.",
            }
        )
    )

    return 0 if supported else 1


if __name__ == "__main__":
    raise SystemExit(main())
