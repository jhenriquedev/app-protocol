import '../../cases/tasks/task_create/task_create.api.case.dart';
import '../../cases/tasks/task_list/task_list.api.case.dart';
import '../../cases/tasks/task_move/task_move.api.case.dart';
import '../../core/shared/app_host_contracts.dart';
import '../../packages/data/index.dart';

class BackendConfig {
  const BackendConfig({this.port = 3000, this.dataDirectory});

  final int port;
  final String? dataDirectory;
}

class BackendRegistry implements AppRegistry {
  BackendRegistry({
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
}

BackendRegistry createRegistry([BackendConfig config = const BackendConfig()]) {
  final data = createDataPackage(config.dataDirectory);

  return BackendRegistry(
    cases: <String, Map<String, AppCaseSurfaces>>{
      'tasks': <String, AppCaseSurfaces>{
        'task_create': AppCaseSurfaces(
          api: (context) => TaskCreateApi(context),
        ),
        'task_list': AppCaseSurfaces(api: (context) => TaskListApi(context)),
        'task_move': AppCaseSurfaces(api: (context) => TaskMoveApi(context)),
      },
    },
    providers: <String, dynamic>{'port': config.port},
    packages: <String, dynamic>{'data': data},
  );
}
