# Monitoring
클러스터와 앱의 상태(CPU, 메모리, pod 재시작, 요청 수 등)를 수집하고 시각화, 알림까지 하는 것

```
수집(Prometheus) → 저장(Prometheus TSDB) → 시각화(Grafana)
                                        └→ 알림(Alertmanager)
```

## kube-prometheus-stack
Prometheus, Grafana, Alertmanager와 수집기들을 한 번에 설치하는 Helm chart
- prometheus-community 저장소에서 제공하는 공개 chart
- 하나씩 설치하면 서로 연결하는 설정이 많은데, chart 하나로 연결까지 끝난 상태로 올라온다
- Grafana에 Kubernetes 대시보드도 기본으로 들어있다

## 설치

[저장소 추가]
```
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
```

[namespace 생성]
```
kubectl create namespace monitoring
```
- 모니터링 관련 리소스를 앱과 분리해서 관리

[설치]
```
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
```
- `prometheus` : Release 이름 → 생성되는 리소스 이름 앞에 `prometheus-`가 붙는다
- `prometheus-community/kube-prometheus-stack` : 저장소/chart
- `-n monitoring` : 설치할 namespace

[확인]
```
helm list -n monitoring
kubectl get pods,svc -n monitoring
```

## 설치된 구성 요소

| 구성 요소 | 종류 | 역할 |
|---|---|---|
| prometheus-kube-prometheus-operator | Deployment | Prometheus, Alertmanager를 CRD로 관리하는 오퍼레이터 |
| prometheus-prometheus-kube-prometheus-prometheus | StatefulSet | 메트릭 수집, 저장 (9090) |
| alertmanager-prometheus-kube-prometheus-alertmanager | StatefulSet | 알림 전송 (9093) |
| prometheus-grafana | Deployment | 대시보드 시각화 (80) |
| prometheus-kube-state-metrics | Deployment | k8s 리소스 상태 메트릭 (pod 상태, replica 수 등) |
| prometheus-prometheus-node-exporter | DaemonSet | 노드 메트릭 (CPU, 메모리, 디스크) → 노드마다 1개 |

- Service는 전부 ClusterIP → 외부에서 바로 접근할 수 없다

## Grafana 비밀번호 확인
```
kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
```
- chart가 설치할 때 Grafana 관리자 비밀번호를 Secret(`prometheus-grafana`)에 저장해둔다
- `-o jsonpath="{.data.admin-password}"` : Secret에서 admin-password 값만 꺼낸다
- Secret 값은 base64로 인코딩되어 있어서 `base64 --decode`로 풀어야 한다 (암호화가 아니라 인코딩)
- `; echo` : 출력 끝에 줄바꿈이 없어서 프롬프트와 붙지 않게 줄바꿈 추가
- 아이디는 `admin` (같은 Secret의 `admin-user`)

## 접속
```
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
```