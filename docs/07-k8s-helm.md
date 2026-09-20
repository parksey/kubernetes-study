# Helm
kubernetes의 패키지 매니저

```
apt(ubuntu), brew(mac), npm(node)처럼
여러 k8s 리소스(YAML)를 하나의 패키지로 묶어서 설치, 업그레이드, 삭제, 롤백을 관리하는 도구
```
- helm으로 묶은 패키지를 **Chart**라고 부른다
- `kubectl apply`를 여러 번 하는 대신 `helm install` 한 번으로 앱 하나를 통째로 설치

## 사용 이유
ingress 실습만 해도 Deployment, Service, Ingress YAML이 여러 개였다. 실제 서비스는 여기에 ConfigMap, Secret, PVC 등이 더 붙는다.

[helm 없이 YAML로만 관리할 때 문제]
- 파일이 많아서 순서대로 `kubectl apply`, 삭제할 때도 하나하나 `kubectl delete`
- 환경(dev, prod)마다 replicas, 이미지 태그, 도메인만 다른데 YAML을 통째로 복사해서 관리
- "지금 클러스터에 떠 있는 게 몇 번째 버전인지" 알기 어렵고, 이전 상태로 되돌리기 어렵다
- redis, kafka, ingress-nginx 같은 오픈소스를 설치하려면 수십 개의 YAML을 직접 받아서 수정

[helm으로 해결]
- 리소스 묶음을 Chart 하나로 설치/삭제
- 바뀌는 값만 `values.yaml`로 빼서 환경별로 다른 값 파일만 넣는다
- 설치할 때마다 버전(revision)이 기록되어 `helm rollback`으로 되돌릴 수 있다
- 공개된 Chart를 받아서 값만 바꿔 설치 (`helm install my-redis bitnami/redis`)

## 핵심 개념
| 개념 | 의미 | 비유 |
|---|---|---|
| Chart | k8s 리소스 템플릿 묶음 (패키지) | 설치 프로그램 |
| Values | 템플릿에 넣을 설정값 (`values.yaml`) | 설치 옵션 |
| Release | Chart를 클러스터에 설치한 실체. 이름을 붙여 구분 | 설치된 프로그램 |
| Repository | Chart를 모아둔 저장소 | 앱 스토어 |

- 같은 Chart로 Release를 여러 개 만들 수 있다 (`redis-dev`, `redis-prod`)
- Release는 설치/업그레이드할 때마다 revision 번호가 올라간다 (1, 2, 3...)

[동작 흐름]
```
Chart(템플릿) + values.yaml(값)
        ↓  helm이 템플릿에 값을 채워 넣음 (렌더링)
완성된 k8s YAML
        ↓  k8s API 서버에 적용
Release (revision 1)
```
- helm이 결국 하는 일은 **YAML을 만들어서 kubectl apply 해주는 것** + 설치 이력 관리
- 설치 이력은 해당 namespace의 Secret에 저장된다 (`sh.helm.release.v1.{release}.v{revision}`)

## Bitnami
이미지와 chart들을 배포하는 회사

```
helm repo add bitnami https://charts.bitnami.com/bitnami
```

[chart 확인]
```
helm show chart {} 
```

[chart의 values 확인]
```
helm show values {}
```