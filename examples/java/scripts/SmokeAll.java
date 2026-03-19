package scripts;

public final class SmokeAll {
  private SmokeAll() {}

  public static void main(String[] args) throws Exception {
    BackendSmoke.main(args);
    PortalSmoke.main(args);
    AgenticSmoke.main(args);
    AgentMcpStdioSmoke.main(args);
    AgentMcpHttpSmoke.main(args);
    System.out.println("smoke_all: ok");
  }
}
