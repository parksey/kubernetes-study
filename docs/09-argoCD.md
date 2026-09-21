# ArgoCD

k8s를 위한 GitOps 도구

git과 cluster 상태 동기화

```
git에 있는 YAML(원하는 상태)과 클러스터에 실제 떠 있는 상태를 계속 비교해서
다르면 git에 맞게 클러스터를 바꿔주는 도구
```
- CD(Continuous Delivery, 배포) 쪽 도구. 빌드, 테스트(CI)는 하지 않는다
- 클러스터 안에 설치되어 동작하는 컨트롤러

## GitOps
git을 배포의 **단일 진실 공급원(Single Source of Truth)** 으로 쓰는 방식
- 클러스터에 무엇이 떠 있어야 하는지는 git에 있는 YAML이 정한다
- 배포 = git에 commit/merge
- 롤백 = git revert
- 누가 언제 무엇을 바꿨는지 git 이력에 그대로 남는다

[ArgoCD 없이 배포할 때 문제]
- 사람이나 CI가 `kubectl apply`, `helm upgrade`를 직접 실행 → 클러스터 접근 권한을 여기저기 나눠줘야 한다
- 누군가 `kubectl edit`으로 직접 고치면 git과 클러스터가 달라진다 (drift) → 아무도 모른다
- "지금 클러스터에 떠 있는 게 git의 어느 커밋인지" 알기 어렵다

## Push 방식 vs Pull 방식

```
[Push] 기존 CI/CD
git push → CI(Jenkins, GitHub Actions) → kubectl apply / helm upgrade → 클러스터
                                         └ CI가 클러스터 권한을 가지고 밖에서 밀어 넣음

[Pull] ArgoCD
git push → git 저장소 ← ArgoCD(클러스터 안)가 주기적으로 확인 → 다르면 클러스터에 적용
                        └ 클러스터 안에서 git을 당겨옴
```

| 구분 | Push (CI가 배포) | Pull (ArgoCD) |
|---|---|---|
| 배포 주체 | 클러스터 밖의 CI | 클러스터 안의 ArgoCD |
| 클러스터 권한 | CI에 kubeconfig를 줘야 함 | 밖으로 권한을 줄 필요 없음 |
| drift 감지 | 배포할 때만 적용, 이후 변경은 모름 | 계속 비교해서 OutOfSync로 표시 |
| 롤백 | 이전 버전으로 다시 배포 | git revert |

- 실무에서는 보통 둘을 섞는다 : CI는 이미지 빌드 + git의 이미지 태그 수정까지만, 배포는 ArgoCD

```
코드 push → CI : 이미지 빌드, 레지스트리 push → 매니페스트 repo의 image tag 수정(commit)
                                                       ↓
                                       ArgoCD가 변경 감지 → 클러스터에 배포
```

## 소스 레포와 배포 레포
ArgoCD가 바라보는 YAML(배포 레포)을 소스 레포와 분리하는 경우가 많다. 필수는 아니고 같은 레포에 둘 수도 있다

```
[분리]  repoURL = myapp-deploy, path = myapp
myapp/                ← 소스 레포 : 소스코드, Dockerfile, CI 설정 (ArgoCD는 모름)
myapp-deploy/         ← 배포 레포 : ArgoCD는 이것만 봄
└── myapp/            ← path
    ├── Chart.yaml
    ├── values.yaml
    └── templates/

[같은 레포]  repoURL = myapp, path = deploy
myapp/
├── src/
├── Dockerfile
└── deploy/           ← path
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```
- Application은 `repoURL`(어느 레포)과 `path`(레포 안의 어느 폴더)를 따로 지정한다
- 분리하면 repoURL 자체가 배포 레포를 가리킨다. 예시 : `labs/argocd/example-project`, `labs/argocd/example-project-deploy`

[분리하는 이유]
- CI 무한 루프 방지 : 같은 레포면 CI가 태그를 바꿔 커밋 → 그 커밋이 다시 CI를 실행 → 경로 필터나 `[skip ci]` 처리가 필요
- 이력 분리 : 코드 이력에 `deploy: tag 변경` 커밋이 섞이지 않는다. 배포 레포 이력 = 배포 이력
- 권한 분리 : 개발자는 소스 레포, prod 배포 승인은 운영 담당자만 배포 레포에 접근
- 여러 서비스를 한곳에서 관리 : 배포 레포 하나에 서비스 A, B, C의 YAML을 모아 클러스터 전체 상태를 한눈에 본다

[같은 레포가 나은 경우]
- 혼자 하거나 작은 프로젝트
- 학습용 : 이 레포의 `labs/helm/echo-app`을 바로 ArgoCD에 연결하는 것이 같은 레포 방식

## 핵심 개념

| 개념 | 의미 |
|---|---|
| Application | "어느 git의 어느 경로를 어느 클러스터, namespace에 배포할지" 정의한 ArgoCD 리소스 (CRD) |
| Source | git 저장소 URL, 경로(path), 브랜치/태그(targetRevision) |
| Destination | 배포할 클러스터와 namespace |
| Project | Application들을 묶어서 배포 가능한 저장소, 클러스터, namespace를 제한하는 단위 (기본 `default`) |
| Sync | git의 상태를 클러스터에 적용하는 것 |

- Application도 결국 k8s 리소스라서 YAML로 만들 수 있다 (`kind: Application`)

[Sync 상태] git과 클러스터가 같은가

| 상태 | 의미 |
|---|---|
| Synced | git과 클러스터가 같음 |
| OutOfSync | git과 클러스터가 다름 (git이 바뀌었거나, 누가 클러스터를 직접 고침) |

[Health 상태] 배포된 리소스가 정상인가

| 상태 | 의미 |
|---|---|
| Healthy | 정상 동작 |
| Progressing | 배포 중 (pod가 아직 Ready가 아님 등) |
| Degraded | 실패 (CrashLoopBackOff, readiness 실패 등) |
| Missing | git에는 있는데 클러스터에 없음 |

- Sync와 Health는 별개 : Synced인데 Degraded일 수 있다 (git대로 배포는 됐는데 pod가 죽는 경우)

## Sync 정책

| 옵션 | 의미 |
|---|---|
| 수동 (기본) | OutOfSync만 표시하고, UI/CLI에서 Sync 버튼을 눌러야 적용 |
| automated | git이 바뀌면 자동으로 Sync |
| prune | git에서 지운 리소스를 클러스터에서도 삭제 (기본은 안 지움) |
| selfHeal | 누가 클러스터를 직접 고치면 다시 git 상태로 되돌림 |

- git은 기본 3분마다 확인 (webhook을 걸면 push 즉시 반영)
- selfHeal을 켜면 `kubectl edit`, `kubectl scale`로 바꾼 값이 다시 원래대로 돌아간다 → 변경은 반드시 git으로

## 구성 요소
설치하면 argocd namespace에 아래 pod들이 뜬다

| 구성 요소 | 역할 |
|---|---|
| argocd-server | Web UI, API, CLI가 접속하는 서버 |
| argocd-repo-server | git 저장소를 받아서 YAML을 만든다 (helm template, kustomize 렌더링) |
| argocd-application-controller | 클러스터 상태와 git 상태를 비교하고 Sync를 실행하는 핵심 컨트롤러 |
| argocd-applicationset-controller | 템플릿 하나로 Application 여러 개를 생성 (환경별, 클러스터별) |
| argocd-redis | 캐시 |
| argocd-dex-server | SSO 로그인 연동 (GitHub, LDAP 등) |

[동작 흐름]
```
git 저장소
   ↓ repo-server가 가져와서 YAML로 렌더링 (plain YAML / helm / kustomize)
원하는 상태(desired)
   ↓ application-controller가 클러스터의 실제 상태(live)와 비교
같으면 Synced / 다르면 OutOfSync
   ↓ Sync (수동 또는 automated)
k8s API 서버에 적용
```

## Helm과 같이 쓰기
Application의 source를 helm chart로 지정할 수 있다

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: echo-app-dev
  namespace: argocd                 # Application 리소스는 argocd namespace에 만든다
spec:
  project: default
  source:
    repoURL: https://github.com/{user}/k8s.git
    targetRevision: main
    path: labs/helm/echo-app        # chart 경로
    helm:
      valueFiles:
        - values-dev.yaml           # helm install -f values-dev.yaml 과 같은 역할
  destination:
    server: https://kubernetes.default.svc   # ArgoCD가 설치된 같은 클러스터
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## 배포 전략과의 관계
- ArgoCD는 git대로 적용까지만 한다. pod를 어떤 순서로 교체할지는 Deployment의 `strategy`가 정한다 (Rolling, Recreate)
- Blue-Green, Canary는 ArgoCD가 아니라 **Argo Rollouts**(별도 프로젝트, `kind: Rollout`)로 ArgoCD와 같이 쓴다
- 배포 전략 비교 → [10-k8s-deploy-strategy.md](10-k8s-deploy-strategy.md)
