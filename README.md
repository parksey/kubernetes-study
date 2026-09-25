# k8s

쿠버네티스 학습과 실습을 한곳에 모아 두는 저장소

## 목적

1. k8s 스터디용
2. 매번 반복되는 환경 구성을 스크립트로 템플릿화.
 

## 학습 내용

| 주제 | 한 것 |
| --- | --- |
| [Docker](docs/01-docker.md) | 컨테이너가 namespace, cgroup으로 격리되는 원리 |
| [k8s 기본](docs/02-k8s-basic.md) | 아키텍처, Pod, Deployment, Service로 앱 배포 |
| [서비스 관리](docs/03-k8s-service-management.md) | Namespace, ConfigMap, Volume, PV/PVC |
| [Probe](docs/04-k8s-life-cycle-probe.md) | Liveness, Readiness, Startup으로 앱 상태 검사 |
| [Resource](docs/05-k8s-resource.md) | requests, limits, OOM, QoS 우선순위 |
| [Ingress](docs/06-k8s-ingress.md) | NodePort 없이 Ingress 하나로 path, host, redirect 라우팅 |
| [Helm](docs/07-k8s-helm.md) | 직접 만든 chart로 install, upgrade, rollback |
| [Monitoring](docs/08-k8s-monitoring.md) | helm으로 Prometheus, Grafana 설치 |
| [ArgoCD](docs/09-argoCD.md) | GitOps, 소스 레포와 배포 레포를 나눈 CI/CD 흐름 |
| [배포 전략](docs/10-k8s-deploy-strategy.md) | Recreate, Rolling, Blue-Green, Canary 비교 |
| [Istio](docs/11-Istio.md) | 서비스 메시, sidecar, 서비스 간 트래픽 제어 |

## 최종 구성

![MSA k8s 아키텍처](docs/images/k8s-msa-architecture.svg)

## 참고

- 인프런 [금융 인프라를 운영하는 Toss 개발자의 Kubernetes](https://www.inflearn.com/course/kubernetes-for-toss)
