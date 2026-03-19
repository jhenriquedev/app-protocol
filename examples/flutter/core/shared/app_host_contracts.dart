import '../agentic.case.dart';
import '../api.case.dart';
import '../domain.case.dart';
import '../stream.case.dart';
import '../ui.case.dart';

typedef DomainCaseFactory = Object Function();
typedef ApiCaseFactory = Object Function(ApiContext ctx);
typedef UiCaseFactory = Object Function(UiContext ctx);
typedef StreamCaseFactory = Object Function(StreamContext ctx);
typedef AgenticCaseFactory =
    BaseAgenticCase<dynamic, dynamic> Function(AgenticContext ctx);

class AppCaseSurfaces {
  const AppCaseSurfaces({
    this.domain,
    this.api,
    this.ui,
    this.stream,
    this.agentic,
  });

  final DomainCaseFactory? domain;
  final ApiCaseFactory? api;
  final UiCaseFactory? ui;
  final StreamCaseFactory? stream;
  final AgenticCaseFactory? agentic;
}

typedef AppCasesRegistry = Map<String, Map<String, AppCaseSurfaces>>;

abstract class AppRegistry {
  AppCasesRegistry get cases;

  Dict get providers;

  Dict get packages;
}

class AgenticCaseRef {
  const AgenticCaseRef({required this.domain, required this.caseName});

  final String domain;
  final String caseName;

  Dict toJson() {
    return {'domain': domain, 'caseName': caseName};
  }
}

class AgenticCatalogEntry<TInput, TOutput> {
  const AgenticCatalogEntry({
    required this.ref,
    required this.publishedName,
    required this.definition,
    required this.isMcpEnabled,
    required this.requiresConfirmation,
    required this.executionMode,
  });

  final AgenticCaseRef ref;
  final String publishedName;
  final AgenticDefinition<TInput, TOutput> definition;
  final bool isMcpEnabled;
  final bool requiresConfirmation;
  final String executionMode;
}

abstract class AgenticRegistry extends AppRegistry {
  List<AgenticCaseRef> listAgenticCases();

  AgenticCaseFactory? getAgenticSurface(AgenticCaseRef ref);

  BaseAgenticCase<dynamic, dynamic> instantiateAgentic(
    AgenticCaseRef ref,
    AgenticContext ctx,
  );

  List<AgenticCatalogEntry<dynamic, dynamic>> buildCatalog(AgenticContext ctx);

  AgenticCatalogEntry<dynamic, dynamic>? resolveTool(
    String toolName,
    AgenticContext ctx,
  );

  List<AgenticCatalogEntry<dynamic, dynamic>> listMcpEnabledTools(
    AgenticContext ctx,
  );
}
