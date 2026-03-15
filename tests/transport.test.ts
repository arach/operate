import { describe, expect, test } from "bun:test";
import {
  createCommandTransport,
  LocalBypassTransport,
  readTransportConfig,
  SshCommandTransport,
  WebSocketCommandTransport
} from "../src/transport";
import { OpenSSHExecutor } from "../src/ssh";

describe("readTransportConfig", () => {
  test("defaults to ssh transport", () => {
    const config = readTransportConfig({});
    expect(config.kind).toBe("ssh");
    expect(config.websocketConnectTimeoutMs).toBe(5000);
  });

  test("reads websocket transport values", () => {
    const config = readTransportConfig({
      OPERATE_TRANSPORT: "websocket",
      OPERATE_WS_URL: "ws://localhost:9999",
      OPERATE_WS_AUTH_TOKEN: "secret-token",
      OPERATE_WS_CONNECT_TIMEOUT_MS: "4200"
    });

    expect(config.kind).toBe("websocket");
    expect(config.websocketUrl).toBe("ws://localhost:9999");
    expect(config.websocketAuthToken).toBe("secret-token");
    expect(config.websocketConnectTimeoutMs).toBe(4200);
  });
});

describe("createCommandTransport", () => {
  test("creates ssh transport for ssh config", () => {
    const transport = createCommandTransport(
      {
        kind: "ssh",
        websocketConnectTimeoutMs: 5000
      },
      new OpenSSHExecutor()
    );

    expect(transport).toBeInstanceOf(LocalBypassTransport);
    expect(transport.getRemote()).toBeInstanceOf(SshCommandTransport);
  });

  test("throws when websocket config is missing URL", () => {
    expect(() =>
      createCommandTransport(
        {
          kind: "websocket",
          websocketConnectTimeoutMs: 5000
        },
        new OpenSSHExecutor()
      )
    ).toThrow("OPERATE_WS_URL is required when OPERATE_TRANSPORT=websocket");
  });

  test("creates websocket transport when websocket config is valid", () => {
    const transport = createCommandTransport(
      {
        kind: "websocket",
        websocketUrl: "ws://localhost:9000",
        websocketAuthToken: "abc",
        websocketConnectTimeoutMs: 5000
      },
      new OpenSSHExecutor()
    );

    expect(transport).toBeInstanceOf(LocalBypassTransport);
    expect(transport.getRemote()).toBeInstanceOf(WebSocketCommandTransport);
  });

  test("runs localhost commands directly without SSH", async () => {
    const transport = createCommandTransport(
      { kind: "ssh", websocketConnectTimeoutMs: 5000 },
      new OpenSSHExecutor()
    );

    const result = await transport.run("localhost", "echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });
});
