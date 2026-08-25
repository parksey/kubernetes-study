# 도커

## 목표

도커가 어떻게 구성되어있는지 간략하게 확인

## 실습 환경

Mac에서는 chroot, namespace, cgroup을 직접 쓸 수 없으므로 리눅스 컨테이너 안에서 실습한다.

| 항목 | 값 |
| --- | --- |
| 위치 | [labs/linux-container](../labs/linux-container) |
| 베이스 이미지 | `ubuntu:24.04` |
| 이미지 이름 | `linux-lab` |
| 실행 | `./labs/linux-container/run.sh` (빌드 후 셸 접속) |

설치된 도구

| 용도 | 도구 |
| --- | --- |
| namespace | `unshare`, `nsenter`, `lsns` |
| 네트워크 | `ip`, `iptables`, `ping` |
| 프로세스 확인 | `ps`, `pstree` |
| chroot용 rootfs | `busybox-static`, `debootstrap` |
| 시스템콜 | `strace`, `gcc` |

`run.sh` 실행 옵션

| 옵션                | 이유 |
|-------------------| --- |
| `--rm`            | 나오면 컨테이너 자동 삭제 |
| `--privileged`    | chroot, mount, unshare 권한 허용 |
| `--cgroupns=host` | cgroup 직접 생성, 수정 |
| `-v work:/environment`     | `work/` 폴더를 컨테이너 `/environment`과 공유. 컨테이너가 삭제돼도 실습 파일이 남음 |

## 실습

### 기초 컨테이너 분리

1. 실습 run.sh 실행

2. 새로운 루프 디렉토리 설정을 폴더 및 bin 생성
```
mkdir -p project-a/bin
```

3. root를 변경
chroot를 사용하게 되면 그 변경하는 곳의 /bin/sh를 확인하게 된다.
이는 `chroot {폴더} {명령어}`와 같이 명령어를 실행하려 하지만 /bin이 없어서 실패하게 되기 때문
```
cp /bin/sh project-a/bin/
```

4. sh를 실행하기 위해 필요한 라이브러리 연관성 확인
/bin/sh를 실행핟기 위해서는 일부 라이브러리들이 필요하다
```
ldd /bin/sh
```
> root@linux-lab:/environment/project-a/bin# ldd /bin/sh
        linux-vdso.so.1 (0x0000ffff9872c000)
        libc.so.6 => /lib/aarch64-linux-gnu/libc.so.6 (0x0000ffff984f0000)
        /lib/ld-linux-aarch64.so.1 (0x0000ffff986f0000)

5. 필요한 라이브러리 copy
```
{
    mkdir -p project-a/lib/aarch64-linux-gnu
    
    cp /lib/ld-linux-aarch64.so.1 project-a/lib/
    cp /lib/aarch64-linux-gnu/libc.so.6 project-a/lib/aarch64-linux-gnu/
}
```

6. 루트 디렉토리 변경

변경하기 전
```
pwd => /environment/project-a
```

```
chroot project-a/
```

```
pwd => /
```

참고. clear를 하면 해당 명령어를 /bin에 등록하지 않았기 때문에 불가능하다

여기가찌가 도커로 새로운 컨테이너 환경을 만들고 해당 컨테이너로 `docker exec -it /bin/sh`를 하여 root를 기반으로하는 컨테이너에 들어가는 것과 같다.

