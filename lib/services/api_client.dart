import 'dart:convert';
import 'package:http/http.dart' as http;

/// HTTP client that wraps all backend API calls with auth headers
class ApiClient {
  final String baseUrl;
  final String userId;
  final String? token;
  final http.Client _client;

  ApiClient({
    required this.baseUrl,
    required this.userId,
    this.token,
    http.Client? client,
  }) : _client = client ?? http.Client();

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
        'X-User-Id': userId,
      };

  Future<Map<String, dynamic>> get(String path) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> post(
      String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> put(
      String path, Map<String, dynamic> body) async {
    final response = await _client.put(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _client.delete(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
        'API 回應格式錯誤: ${response.body.substring(0, 100)}',
        statusCode: response.statusCode,
      );
    }
    if (response.statusCode >= 400) {
      throw ApiException(
        body['error'] as String? ?? 'API 錯誤',
        statusCode: response.statusCode,
      );
    }
    return body;
  }

  void dispose() => _client.close();
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, {required this.statusCode});
  @override
  String toString() => 'ApiException($statusCode): $message';
}
