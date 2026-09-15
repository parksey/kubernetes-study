# Resource
노드에서 실행되는데 리소스를 설정하지 않으면 하나의 pod에서 리소스 전체를 잡아먹으면서 문제가 발생할 수 있다.
- 설정단위는 컨테이너 단위이다.

## requests
pod가 필요한 최소 리소스.
scheduler는 request를 기준으로 pod 배치할 노드 선택

## limits
pod가 사용할 수 있는 최대 리소스

## OOM
oom이 발생했을때 k8s는 self healing을 진행하기 때문에 CrashLoopBackOff가 발생한다.

```
oom-pod   0/1     CrashLoopBackOff   1 (3s ago)   9s
oom-pod   0/1     OOMKilled          2 (18s ago)   24s
```

## QoS 우선순위
노드의 메모리가 부족해지면 어떤 pod를 먼저 죽일지 정하는 기준.
- k8s가 pod의 requests/limits 설정을 보고 자동으로 QoS 클래스를 붙인다 (직접 지정하는 값이 아님)

| QoS 클래스 | 조건 | 죽는 순서 |
|---|---|---|
| Guaranteed | 모든 컨테이너가 CPU, 메모리 둘 다 requests = limits | 가장 나중 |
| Burstable | Guaranteed는 아니지만 requests나 limits가 하나라도 있음 | 중간 |
| BestEffort | 모든 컨테이너에 requests, limits가 하나도 없음 | **가장 먼저** |

```
BestEffort → Burstable → Guaranteed 순서로 죽는다
```

[Guaranteed]
```yaml
resources:
  requests:
    cpu: 500m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 256Mi
```
- requests와 limits가 같다 = 예약한 만큼만 쓴다 → 노드 입장에서 예측 가능
- limits만 적으면 requests가 limits와 같은 값으로 자동 설정되어 Guaranteed가 된다
- DB처럼 절대 죽으면 안 되는 pod에 사용

[Burstable]
```yaml
resources:
  requests:
    cpu: 250m
    memory: 128Mi
  limits:
    memory: 512Mi
```
- 평소엔 requests만큼 예약하고, 노드에 여유가 있으면 limits까지 더 쓸 수 있다 (burst)
- 가장 흔하게 쓰는 형태
- 같은 Burstable끼리는 requests보다 많이 쓰고 있는 pod가 먼저 죽는다

[BestEffort]
```yaml
# resources 설정 없음
```
- 노드에 남는 자원을 아무 보장 없이 사용
- 메모리 부족 시 가장 먼저 쫓겨남

[확인]
```
kubectl get pod {pod} -o jsonpath='{.status.qosClass}'
kubectl describe pod {pod}     # QoS Class: Burstable
```

[누가 죽이는가]
- kubelet eviction: 노드 메모리가 임계값 아래로 떨어지면 kubelet이 pod를 내쫓는다 (`Evicted`)
  - requests보다 많이 쓰고 있는 pod가 우선 대상 → 사실상 BestEffort, Burstable이 먼저
- 리눅스 OOM killer: kubelet이 대응하기 전에 메모리가 바닥나면 커널이 프로세스를 죽인다 (`OOMKilled`)
  - kubelet이 QoS에 따라 컨테이너의 `oom_score_adj`를 설정해 둔다
  - Guaranteed: -997 (거의 안 죽음) / Burstable: 2~999 / BestEffort: 1000 (가장 먼저)

[OOM과의 차이]
- 위의 OOM 예시는 컨테이너가 **자기 limits**를 넘어서 죽은 것 → QoS와 상관없이 죽는다
- QoS 우선순위는 **노드 전체** 메모리가 부족할 때 누구를 먼저 희생시킬지의 문제
