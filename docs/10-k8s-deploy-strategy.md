# 배포 전략
새 버전(v2)을 띄우고 기존 버전(v1)을 내리는 방식

| 전략 | 다운타임 | 롤백 속도 | 추가 리소스 | 복잡도 | 사용하는 경우 |
|---|---|---|---|---|---|
| Recreate | 있음 | 느림 (다시 배포) | 없음 | 낮음 | 구 버전과 신 버전이 동시에 떠 있으면 안 될 때 |
| Rolling | 없음 | 보통 (다시 rolling) | 조금 (maxSurge만큼) | 낮음 | 기본값. 대부분의 무상태 서비스 |
| Blue-Green | 없음 | 즉시 (전환만 되돌림) | 2배 | 중간 | 안정성이 중요하고 즉시 롤백이 필요할 때 |
| Canary | 없음 | 빠름 (비율을 0으로) | 조금 | 높음 | 일부 사용자에게만 먼저 내보내 검증할 때 |

- Recreate, Rolling은 Deployment 기본 기능 (`spec.strategy.type`)
- Blue-Green, Canary는 직접 구성하거나 Argo Rollouts 같은 도구를 쓴다

## Recreate
기존 pod를 전부 내린 뒤 새 pod를 올린다

```
t1  v1 v1 v1
t2  (없음)          ← 다운타임
t3  v2 v2 v2
```

```yaml
spec:
  strategy:
    type: Recreate
```
- v1, v2가 동시에 떠 있으면 안 되는 경우 : DB 스키마가 바뀌어 v1이 깨진다, 같은 볼륨(ReadWriteOnce)을 하나만 붙일 수 있다 등

## Rolling Update
같은 Deployment 안에서 pod를 하나씩 교체한다 (기본값)

```
t1  v1 v1 v1
t2  v1 v1 v2        ← 섞여 있음 : 사용자 A는 v1, B는 v2 응답을 받을 수 있다
t3  v1 v2 v2
t4  v2 v2 v2
```

```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # replicas보다 최대 몇 개 더 띄울 수 있나 (기본 25%)
      maxUnavailable: 0  # 교체 중 최대 몇 개까지 Ready가 아니어도 되나 (기본 25%)
```
- 새 pod가 readiness probe를 통과해야 다음 pod를 교체한다 → probe가 없으면 준비 안 된 pod로 트래픽이 간다
- 롤백 : `kubectl rollout undo deployment/{name}` → 같은 과정을 거꾸로 (시간이 걸린다)

```
kubectl rollout status deployment/{name}    # 진행 상황
kubectl rollout history deployment/{name}   # 이력
kubectl rollout undo deployment/{name}      # 이전 버전으로
```

## Blue-Green
신 버전을 통째로 옆에 띄우고, 트래픽을 한 번에 전환한다

```
t1  blue(v1)  v1 v1 v1  ← Service
t2  blue(v1)  v1 v1 v1  ← Service      green(v2) v2 v2 v2  (트래픽 없이 미리 테스트)
t3  blue(v1)  v1 v1 v1                 green(v2) v2 v2 v2  ← Service  (selector 변경)
t4  blue 삭제 (또는 롤백 대비로 잠시 유지)
```

[k8s 기본 리소스로 구성]
- Deployment 2개 (`version: blue`, `version: green` label)
- Service의 selector만 바꿔서 전환

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    version: green   # blue → green 으로 바꾸면 트래픽이 한 번에 넘어간다
  ports:
    - port: 80
      targetPort: 3000
```
- 롤백 : selector를 blue로 되돌리면 즉시 (blue가 아직 떠 있으니까)
- 비용 : 전환 전까지 pod가 2배

## Rolling vs Blue-Green

| 구분 | Rolling | Blue-Green |
|---|---|---|
| 교체 단위 | pod 하나씩 | 환경 통째로 |
| 버전 혼재 | 있음 (v1, v2 동시 응답) | 없음 |
| 추가 리소스 | maxSurge만큼 | 2배 |
| 롤백 | 다시 rolling → 시간 걸림 | selector만 되돌림 → 즉시 |
| 전환 전 검증 | 어려움 (바로 트래픽 받음) | green에 트래픽 없이 테스트 가능 |

- Rolling : 조금씩 바꿔서 리소스를 아끼지만, 섞이고 되돌리기 느리다
- Blue-Green : 리소스 2배를 내고, 섞이지 않고 즉시 되돌린다

## Canary
신 버전에 트래픽을 조금만 보내서 검증한 뒤 비율을 늘린다

```
v1 90% / v2 10%  → 에러율, 응답 시간 확인
v1 50% / v2 50%
v1  0% / v2 100%
문제 생기면 v2 0% 로 되돌림
```
- 문제가 생겨도 일부 사용자만 영향을 받는다
- 비율 조절, 지표 확인, 자동 중단까지 하려면 도구가 필요해서 복잡하다
  - ingress-nginx의 canary annotation (`nginx.ingress.kubernetes.io/canary-weight: "10"`)
  - Argo Rollouts, Istio 같은 서비스 메시
