const http = require("http");
const os = require("os");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok\n");
  }

  // 어떤 pod가 응답했는지 보이도록 hostname(= pod 이름)을 함께 반환
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "new hello k8s", hostname: os.hostname() }) + "\n");
});

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
});

// pod 종료 시 k8s가 보내는 SIGTERM을 받아 정상 종료
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  server.close(() => process.exit(0));
});
