# Probe
어플리케이션이 정상적으로 동작하는지를 확인하는 기능

```
컨테이너가 실행된다고 해서 어플리케이션이 정상적으로 동작한다는 것을 보장할 수 없다.
kubernetes는 컨테이너가 살아있는지만 확인한다.
```
- db연결이 끊김
- 메모리 누수
- 교착 상태(deadlock)

등등

이런 경우 프로세스는 살아있어서 컨테이너는 `Running`이지만 요청은 처리하지 못한다.
Probe는 kubelet이 주기적으로 앱에 직접 물어봐서 이런 상태를 잡아낸다.

```
kubelet → (주기적으로) 컨테이너에 검사 요청 → 성공 / 실패
                                               └ 실패가 failureThreshold번 연속이면 조치
```
- Probe를 실행하는 주체는 컨트롤 플레인이 아니라 각 노드의 kubelet

## 검사 방법

| 방법 | 성공 조건 | 예시 |
|---|---|---|
| httpGet | HTTP 응답 코드 200~399 | `GET /health` |
| tcpSocket | 포트에 TCP 연결 성공 | DB, Redis 등 HTTP가 없는 앱 |
| exec | 컨테이너 안에서 명령 실행 후 종료 코드 0 | `cat /tmp/healthy` |
| grpc | gRPC Health Checking 응답이 SERVING | gRPC 서버 |

<details>
<summary>nginx 예시 (tcpSocket + httpGet)</summary>

```yaml
livenessProbe:
  tcpSocket:          # 살아있나? → 포트만 열려 있으면 충분
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:            # 트래픽 받을 수 있나? → 실제로 응답이 오는지
    path: /
    port: 80
  initialDelaySeconds: 3
  periodSeconds: 5
```
- tcpSocket은 포트가 열렸는지만 본다. nginx가 500 에러를 내도 성공
- liveness는 가볍게 tcpSocket, readiness는 실제 응답을 보는 httpGet

</details>

<details>
<summary>Redis 예시 (tcpSocket + exec)</summary>

```yaml
livenessProbe:
  tcpSocket:
    port: 6379
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  exec:
    command: ["sh", "-c", "redis-cli ping | grep PONG"]
  initialDelaySeconds: 5
  periodSeconds: 5
```
- `redis-cli ping`만 쓰면 비밀번호 오류 같은 에러 응답에도 종료 코드가 0이라 성공 처리될 수 있다 → `grep PONG`으로 응답까지 확인
- 비밀번호가 있으면 `redis-cli -a $REDIS_PASSWORD ping`

</details>

<details>
<summary>Kafka 예시 (startup + tcpSocket)</summary>

```yaml
startupProbe:
  tcpSocket:
    port: 9092
  periodSeconds: 10
  failureThreshold: 30     # 최대 300초까지 기동 대기
livenessProbe:
  tcpSocket:
    port: 9092
  periodSeconds: 10
readinessProbe:
  tcpSocket:
    port: 9092
  periodSeconds: 5
```
- 브로커 포트(9092)를 tcpSocket으로 검사
- 기동이 느리고 재시작 시 로그 복구로 수 분이 걸리기도 해서 startup probe를 거의 항상 같이 둔다
- `kafka-topics.sh` 같은 명령을 exec로 쓰면 매번 JVM이 떠서 무겁다 → probe로는 잘 안 쓴다

</details>

[DB, 미들웨어 probe 주의]
- 복제 동기화, 파티션 상태 같은 클러스터 전체 상태를 probe에 넣지 않는다 → 노드 하나 문제로 다른 pod까지 줄줄이 재시작/제외
- 보통 StatefulSet + PVC로 운영하고, 재시작 비용(데이터 복구, 재동기화)이 커서 liveness를 너무 깐깐하게 잡지 않는다

## 공통 설정

| 필드 | 기본값 | 의미 |
|---|---|---|
| initialDelaySeconds | 0 | 컨테이너 시작 후 첫 검사까지 대기 시간 |
| periodSeconds | 10 | 검사 주기 |
| timeoutSeconds | 1 | 응답 대기 시간. 넘기면 실패 |
| failureThreshold | 3 | 연속 몇 번 실패해야 실패로 판단할지 |
| successThreshold | 1 | 실패 후 연속 몇 번 성공해야 성공으로 볼지 (liveness/startup은 1만 가능) |

- 실패로 판단되기까지 걸리는 시간 ≈ `periodSeconds × failureThreshold` (기본 10초 × 3 = 약 30초)

## 종류

### Liveness Probe
컨테이너가 살아있는지, 정상적으로 동작하고 있는지
- 실패하면 kubelet이 컨테이너를 **재시작**한다 (pod의 `restartPolicy`에 따름)
- 교착 상태처럼 재시작하면 회복되는 문제에 사용
- 재시작할 때마다 `RESTARTS` 횟수가 올라가고, 계속 실패하면 `CrashLoopBackOff`

```
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

[주의]
- DB 같은 외부 의존성을 liveness에서 검사하면 안 된다
  - DB가 죽으면 모든 pod가 같이 재시작 → 재시작해도 해결되지 않고 장애만 커진다
  - 외부 의존성 확인은 readiness에서
- 검사 엔드포인트는 가볍게. 무거우면 timeout으로 멀쩡한 컨테이너가 재시작된다

### Readiness Probe
트래픽을 받을 수 있는 것인가
- 재시작을 하지는 않는다.
- 실패하면 Service의 EndpointSlice에서 해당 pod를 **제외**한다 → 트래픽이 오지 않음
- 다시 성공하면 EndpointSlice에 다시 추가된다
- pod가 살아있는 동안 계속 검사한다 (처음 한 번만이 아님)

```
READY 0/1  → Service가 트래픽을 보내지 않음
READY 1/1  → 트래픽 받음
```

사용하는 경우
- 앱 시작 직후 캐시 로딩, 설정 읽기 등으로 아직 요청을 못 받을 때
- DB 연결이 끊기는 등 일시적으로 요청을 처리할 수 없을 때
- 롤링 업데이트: 새 pod가 Ready가 되어야 기존 pod를 내리므로, 준비 안 된 pod로 트래픽이 가지 않는다

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 5
  failureThreshold: 3
```

### Startup Probe
앱이 시작을 마쳤는가
- 시작이 오래 걸리는 앱(대형 Spring 앱, 초기 데이터 로딩 등)을 위한 Probe
- startup probe가 성공하기 전까지 liveness, readiness probe는 **실행되지 않는다**
- 성공하면 이후로는 다시 실행하지 않고 liveness/readiness에게 넘긴다
- `failureThreshold × periodSeconds` 안에 성공하지 못하면 컨테이너를 재시작한다

[왜 필요한가]
```
시작에 60초 걸리는 앱 + liveness만 설정 (기본 약 30초 후 실패 판단)
→ 시작도 하기 전에 liveness 실패 → 재시작 → 또 실패 → 무한 재시작
```
- `initialDelaySeconds`를 길게 줘도 되지만, 그러면 실행 중 장애 감지도 같이 늦어진다
- startup probe로 "시작"과 "실행 중"의 기다리는 시간을 분리한다

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 3000
  periodSeconds: 10
  failureThreshold: 30   # 최대 10초 × 30 = 300초까지 시작을 기다림
```

## 비교

| 구분 | Liveness | Readiness | Startup |
|---|---|---|---|
| 질문 | 살아있나? | 트래픽 받을 수 있나? | 시작이 끝났나? |
| 실패 시 | 컨테이너 재시작 | Service에서 제외 (재시작 X) | 컨테이너 재시작 |
| 검사 시점 | startup 성공 후 계속 | startup 성공 후 계속 | 시작할 때만 |
| 주 용도 | 교착 상태 등 회복 불가 상태 | 일시적 준비 안 됨, 롤링 업데이트 | 시작이 느린 앱 |

## 같이 사용 예시
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: probe-pod
spec:
  containers:
    - name: api
      image: api-node:v1
      imagePullPolicy: Never
      ports:
        - containerPort: 3000
      startupProbe:
        httpGet:
          path: /health
          port: 3000
        periodSeconds: 5
        failureThreshold: 12   # 최대 60초까지 시작 대기
      livenessProbe:
        httpGet:
          path: /health
          port: 3000
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /health
          port: 3000
        periodSeconds: 5
```

```
kubectl get pod probe-pod -w        # READY, RESTARTS 변화 확인
kubectl describe pod probe-pod      # Events에 "Liveness probe failed" 등 실패 이유가 나온다
```
