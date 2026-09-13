# Namespace를 통한 리소스 Grouping

## Namespace
하나의 클러스터안에서 리소스를 논리적으로 분리

### 사용 이유
1. 환경 분리: dev, stage, prod환경을 분리
2. 팀별 분리: 팀A, 팀B형태로 리소스나 접근권한을 팀별로 분리

```
kubectl get ns

NAME              STATUS   AGE
default           Active   76d
kube-node-lease   Active   76d
kube-public       Active   76d
kube-system       Active   76d
```

### 생성
```
# 명령어
kubectl create namespace {}

# yaml
kubectl apply -f namespace.yaml
```

[pod 적용]
```
metadata.namespace: {생성한 namespace}
```
- `kubectl get pods` <= 해당 명령어로는 확인 불가
- `kubectl get pods -n {namespace}` 


### 접근
```
같은 namespace에 있는 서비스들 간 접근은 단순 서비스명을 통해서 접근이 가능하지만
다른 서비스의 경우

other-service.namespace.svc.cluster.local과 같이 접근한다
```

![Namespace 간 Service 접근](images/k8s-namespace-service-dns.svg)

# ConfigMap
application의 설정을 관리하기 위한 기능.

[configmap 생성]
```
kubectl apply -f configmap.yaml
```
- 일반적으로 유지보수를 생각했을때 yaml을 사용한다

## POD 주입
pod에 적용할 수 있는 방법은
1. 환경 변수 주입
2. 파일로 마운트

# Mount
container는 꺼졌다 켜지면 기존 데이터를 유지하지 못한다. 하지만 volumn을 사용하면 데이터를 외부에 저장 가능
```
Mount를 하면 pod가 종료되더라도 외부에 저장되기때문에 종속되지 않는다
따라서 데이터가 남아있을 수 있다.

또한 같은  pod안에 여러 컨테이너가 있을때 main container의 데이터를 사이드카 컨테이너에서 필요로하는 경우
```

## 종류

### EmptyDir
- 파드와 함께 생성되는 임시 저장소. 
- 파드안에 여러 컨테이너가 데이터를 공유할때 사용
- 파드가 종료되면 같이 데이터도 사라진다.

### hostPath
- 노드의 파일시스템을 마운트할때만
- 파드가 다른 노드로 옮겨지면 접근 불가
- 연결 용도로만 사용하기 때문에 테스트 용도

### PV / PVC
- 영구 저장소 할당
- pod의 생명주기와 상관없이 데이터가 유지된다. pod가 삭제되거나 다른 노드로 옮겨져도 같은 저장소를 다시 붙일 수 있다.

[PV와 PVC]
```
PV  (PersistentVolume)      : 실제 저장소 자체. 클러스터 리소스 (namespace 없음)
PVC (PersistentVolumeClaim) : "이런 저장소가 필요하다"는 요청서. namespace에 속함

pod → PVC → PV → 실제 디스크(노드 디스크, NFS, AWS EBS 등) 
```
- pod는 PV를 직접 모르고 PVC 이름만 안다
- 저장소가 무엇인지(EBS인지 NFS인지)는 PV 쪽에 숨겨져 있어서, 앱 YAML은 환경이 바뀌어도 그대로 쓸 수 있다
- 역할 분리: 관리자는 PV(저장소)를 준비하고, 개발자는 PVC로 "10Gi 필요"만 요청

[바인딩]
```
PVC 생성 → 조건(용량, accessModes, storageClass)이 맞는 PV를 찾아 1:1로 연결 → Bound
```
- 맞는 PV가 없으면 PVC는 `Pending`으로 남고, 그 PVC를 쓰는 pod도 `Pending`

[프로비저닝 방식]
- 정적: 관리자가 PV를 미리 만들어 두고, PVC가 그중 하나와 연결
- 동적: PVC에 `storageClassName`을 적으면 StorageClass가 PV를 자동으로 생성
  - 실무에서는 대부분 동적 방식
  - minikube는 기본 StorageClass `standard`가 있어서 PVC만 만들어도 PV가 자동으로 생긴다

```
kubectl get storageclass

NAME                 PROVISIONER                RECLAIMPOLICY   VOLUMEBINDINGMODE
standard (default)   k8s.io/minikube-hostpath   Delete          Immediate
```

[accessModes]
- ReadWriteOnce(RWO): 한 노드에서만 읽기/쓰기. 대부분의 블록 디스크(EBS 등)
- ReadOnlyMany(ROX): 여러 노드에서 읽기만
- ReadWriteMany(RWX): 여러 노드에서 읽기/쓰기. NFS 같은 공유 파일시스템이 필요
- ReadWriteOncePod(RWOP): pod 하나만 읽기/쓰기

[reclaimPolicy: PVC를 지웠을 때 PV를 어떻게 할지]
- Delete: PV와 실제 저장소까지 삭제 (동적 프로비저닝 기본값)
- Retain: PV와 데이터를 남겨둠. 관리자가 직접 정리해야 한다. 운영 DB 등 중요한 데이터에 사용

```
kubectl get pvc     # STATUS Bound, VOLUME에 자동 생성된 PV 이름
kubectl get pv      # CLAIM에 default/data-pvc

# pod를 지우고 다시 만들어도 log.txt에 이전 기록이 남아있다
kubectl delete pod pvc-pod
kubectl apply -f pvc-pod.yaml
kubectl exec pvc-pod -- cat /data/log.txt
```

[emptyDir / hostPath / PV 비교]

| 구분 | emptyDir | hostPath | PV/PVC |
|---|---|---|---|
| 데이터 수명 | pod와 함께 삭제 | 노드에 남음 | pod와 무관하게 유지 |
| 다른 노드로 이동 시 | - | 데이터 접근 불가 | 다시 연결 가능 (스토리지 종류에 따라) |
| 용도 | 컨테이너 간 임시 공유 | 테스트, 노드 파일 접근 | DB 등 영구 데이터 |