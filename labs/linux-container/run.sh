#!/usr/bin/env bash
# 실습 컨테이너 빌드 후 접속한다.
# --privileged: chroot, unshare, mount, cgroup 조작에 필요한 권한
# --cgroupns=host: 호스트 cgroup 트리를 그대로 보고 직접 만들어보기 위해
set -euo pipefail
cd "$(dirname "$0")"

IMAGE=linux-lab

docker build -t "$IMAGE" .
docker run --rm -it \
  --name linux-lab \
  --privileged \
  --cgroupns=host \
  --hostname linux-lab \
  -v "$PWD/work:/environment" \
  "$IMAGE"
