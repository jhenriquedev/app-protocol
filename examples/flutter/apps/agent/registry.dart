import '../../cases/tasks/task_create/task_create.agentic.case.dart';
import '../../cases/tasks/task_create/task_create.api.case.dart';
import '../../cases/tasks/task_list/task_list.agentic.case.dart';
import '../../cases/tasks/task_list/task_list.api.case.dart';
import '../../cases/tasks/task_move/task_move.agentic.case.dart';
import '../../cases/tasks/task_move/task_move.api.case.dart';
import '../../core/agentic.case.dart';
import '../../core/shared/app_host_contracts.dart';
import '../../packages/data/index.dart';
import 'mcp_http.dart';
import 'mcp_stdio.dart';

class AgentConfig {
  const AgentConfig({this.port = 3001, this.dataDirectory});

  final int port;
  final String? dataDirectory;
}

String _toPublishedToolName(AgenticCatalogEntry<dynamic, dynamic> entry) {
  if (entry.isMcpEnabled) {
    return entry.definition.mcp?.name ?? entry.definition.tool.name;
  }

  return entry.definition.tool.name;
}

class AppAgentRegistry implements AgenticRegistry {
  AppAgentRegistry({
    required AppCasesRegistry cases,
    required Map<String, dynamic> providers,
    required Map<String, dynamic> packages,
  }) : _cases = cases,
       _providers = providers,
       _packages = packages;

  final AppCasesRegistry _cases;
  final Map<String, dynamic> _providers;
  final Map<String, dynamic> _packages;

  @override
  AppCasesRegistry get cases => _cases;

  @override
  Map<String, dynamic> get providers => _providers;

  @override
  Map<String, dynamic> get packages => _packages;

  @override
  List<AgenticCaseRef> listAgenticCases() {
    final refs = <AgenticCaseRef>[];

    cases.forEach((String domain, Map<String, AppCaseSurfaces> domainCases) {
      domainCases.forEach((String caseName, AppCaseSurfaces surfaces) {
        if (surfaces.agentic != null) {
          refs.add(AgenticCaseRef(domain: domain, caseName: caseName));
        }
      });
    });

    return refs;
  }

  @override
  AgenticCaseFactory? getAgenticSurface(AgenticCaseRef ref) {
    return cases[ref.domain]?[ref.caseName]?.agentic;
  }

  @override
  BaseAgenticCase<dynamic, dynamic> instantiateAgentic(
    AgenticCaseRef ref,
    AgenticContext ctx,
  ) {
    final surface = getAgenticSurface(ref);
    if (surface == null) {
      throw Exception(
        'Agentic surface not found for ${ref.domain}/${ref.caseName}',
      );
    }

    return surface(ctx);
  }

  @override
  List<AgenticCatalogEntry<dynamic, dynamic>> buildCatalog(AgenticContext ctx) {
    return listAgenticCases()
        .map((AgenticCaseRef ref) {
          final instance = instantiateAgentic(ref, ctx);
          final definition = instance.definition();
          final requiresConfirmation = instance.requiresConfirmation();

          final entry = AgenticCatalogEntry<dynamic, dynamic>(
            ref: ref,
            publishedName: '',
            definition: definition,
            isMcpEnabled: instance.isMcpEnabled(),
            requiresConfirmation: requiresConfirmation,
            executionMode:
                definition.policy?.executionMode ??
                (requiresConfirmation ? 'manual-approval' : 'direct-execution'),
          );

          return AgenticCatalogEntry<dynamic, dynamic>(
            ref: entry.ref,
            publishedName: _toPublishedToolName(entry),
            definition: entry.definition,
            isMcpEnabled: entry.isMcpEnabled,
            requiresConfirmation: entry.requiresConfirmation,
            executionMode: entry.executionMode,
          );
        })
        .toList(growable: false);
  }

  @override
  AgenticCatalogEntry<dynamic, dynamic>? resolveTool(
    String toolName,
    AgenticContext ctx,
  ) {
    final normalized = toolName.trim();
    for (final entry in buildCatalog(ctx)) {
      if (entry.publishedName == normalized ||
          entry.definition.tool.name == normalized) {
        return entry;
      }
    }

    return null;
  }

  @override
  List<AgenticCatalogEntry<dynamic, dynamic>> listMcpEnabledTools(
    AgenticContext ctx,
  ) {
    return buildCatalog(ctx)
        .where(
          (AgenticCatalogEntry<dynamic, dynamic> entry) => entry.isMcpEnabled,
        )
        .toList(growable: false);
  }
}

AppAgentRegistry createRegistry([AgentConfig config = const AgentConfig()]) {
  final data = createDataPackage(config.dataDirectory);

  return AppAgentRegistry(
    cases: <String, Map<String, AppCaseSurfaces>>{
      'tasks': <String, AppCaseSurfaces>{
        'task_create': AppCaseSurfaces(
          api: (context) => TaskCreateApi(context),
          agentic: (context) => TaskCreateAgentic(context),
        ),
        'task_list': AppCaseSurfaces(
          api: (context) => TaskListApi(context),
          agentic: (context) => TaskListAgentic(context),
        ),
        'task_move': AppCaseSurfaces(
          api: (context) => TaskMoveApi(context),
          agentic: (context) => TaskMoveAgentic(context),
        ),
      },
    },
    providers: <String, dynamic>{
      'port': config.port,
      'mcpAdapters': <String, dynamic>{
        'stdio': StdioAppMcpAdapter(),
        'http': StreamableHttpAppMcpAdapter(),
      },
    },
    packages: <String, dynamic>{'data': data},
  );
}
