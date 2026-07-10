type RouteCallback = (params: Record<string, string>) => void;

export class Router {
  private routes = new Map<string, RouteCallback>();
  private current = "";

  on(view: string, callback: RouteCallback): void {
    this.routes.set(view, callback);
  }

  navigate(view: string, params: Record<string, string> = {}): void {
    this.current = view;
    const handler = this.routes.get(view);
    if (handler) handler(params);
  }

  getCurrent(): string {
    return this.current;
  }
}
