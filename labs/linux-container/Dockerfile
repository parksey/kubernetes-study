# chroot, namespace, cgroup 실습용 리눅스 환경
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      # namespace: unshare, nsenter, lsns
      util-linux \
      # network namespace, veth
      iproute2 iptables iputils-ping \
      # 프로세스 확인: ps, pstree
      procps psmisc \
      # chroot용 최소 rootfs 재료
      busybox-static debootstrap \
      # 시스템콜 추적, C로 직접 clone() 호출해보기
      strace gcc libc6-dev make \
      vim less curl ca-certificates tree \
    && rm -rf /var/lib/apt/lists/*

CMD ["bash"]
