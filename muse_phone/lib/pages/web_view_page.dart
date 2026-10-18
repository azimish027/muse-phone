/// WebView 页 — 嵌套 RPG (Hunter Quest) / Mind (Astral Hearth)
/// 使用 flutter_inappwebview 加载打包进 assets 的静态 bundle

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class WebViewPage extends StatefulWidget {
  final String title;
  final String assetPath; // e.g. 'assets/webviews/rpg/index.html'

  const WebViewPage({
    super.key,
    required this.title,
    required this.assetPath,
  });

  @override
  State<WebViewPage> createState() => _WebViewPageState();
}

class _WebViewPageState extends State<WebViewPage> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (err) {
            debugPrint('WebView error: ${err.description}');
          },
        ),
      )
      // 加载本地 assets 里的静态 bundle
      // flutter_inappwebview 会用 flutter:// scheme 或 file:///android_asset 访问
      ..loadFlutterAsset(widget.assetPath);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _controller.reload(),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
