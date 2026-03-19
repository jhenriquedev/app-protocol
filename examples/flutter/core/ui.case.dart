import 'shared/app_base_context.dart';
import 'shared/app_infra_contracts.dart';
import 'domain.case.dart';

class UiContext extends AppBaseContext {
  const UiContext({
    required super.correlationId,
    required super.logger,
    super.executionId,
    super.tenantId,
    super.userId,
    super.config,
    this.renderer,
    this.router,
    this.store,
    this.api,
    this.packages,
    this.extra,
  });

  final dynamic renderer;
  final dynamic router;
  final dynamic store;
  final AppHttpClient? api;
  final Dict? packages;
  final Dict? extra;
}

typedef UIState = Map<String, dynamic>;

abstract class BaseUiCase<TState extends UIState> {
  BaseUiCase(this.ctx, this.state);

  final UiContext ctx;
  TState state;

  Object view();

  Future<void> test() async {}

  void setState(Map<String, dynamic> partial) {
    state = {...state, ...partial} as TState;
  }
}
