import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:qr_code_scanner_plus/qr_code_scanner_plus.dart';
import 'package:share_plus/share_plus.dart' hide XFile;
import 'package:url_launcher/url_launcher.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CanadaAutoPecasScannerApp());
}

const String kBackendBaseUrl = 'https://autopecascanada.onrender.com';
const String kPainelWebBaseUrl = 'https://hingborn.github.io/autope-as-canada';

class CanadaAutoPecasScannerApp extends StatelessWidget {
  const CanadaAutoPecasScannerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Canada Auto Peças - Leitor & Cadastro',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF121212),
        primaryColor: const Color(0xFFFFC300),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFFC300),
          secondary: Color(0xFFFFC300),
          surface: Color(0xFF1E1E1E),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1A1A1A),
          foregroundColor: Color(0xFFFFC300),
          elevation: 0,
        ),
      ),
      home: const HomeScannerPage(),
    );
  }
}

class PecaModel {
  final String mongoId;
  final String codigo;
  final String nome;
  final String marca;
  final int estoque;
  final double preco;
  final String localizacao;
  final String qrToken;
  final List<String> fotos;

  PecaModel({
    required this.mongoId,
    required this.codigo,
    required this.nome,
    required this.marca,
    required this.estoque,
    required this.preco,
    required this.localizacao,
    required this.qrToken,
    required this.fotos,
  });

  factory PecaModel.fromJson(Map<String, dynamic> json) {
    List<String> listaFotos = [];
    if (json['imagensUrls'] is List && (json['imagensUrls'] as List).isNotEmpty) {
      listaFotos = (json['imagensUrls'] as List).map((e) => e.toString()).toList();
    } else if (json['imagemUrl'] != null && json['imagemUrl'].toString().isNotEmpty) {
      listaFotos = [json['imagemUrl'].toString()];
    }

    double precoConvertido = 0.0;
    if (json['preco'] != null) {
      precoConvertido = double.tryParse(json['preco'].toString().replaceAll(',', '.')) ?? 0.0;
    }

    int estoqueConvertido = 0;
    if (json['estoque'] != null) {
      estoqueConvertido = int.tryParse(json['estoque'].toString()) ?? 0;
    }

    return PecaModel(
      mongoId: (json['_id'] ?? '').toString(),
      codigo: (json['id'] ?? '').toString(),
      nome: (json['nome'] ?? 'Peça Automotiva').toString(),
      marca: (json['marca'] ?? 'Multimarcas').toString(),
      estoque: estoqueConvertido,
      preco: precoConvertido,
      localizacao: (json['localizacao'] ?? 'Não informada').toString(),
      qrToken: (json['qrToken'] ?? '').toString(),
      fotos: listaFotos,
    );
  }

  String get precoFormatado {
    final formatador = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    return formatador.format(preco);
  }

  String get linkCompartilhamentoCliente {
    final idRef = codigo.isNotEmpty ? codigo : mongoId;
    return '$kBackendBaseUrl/p/${Uri.encodeComponent(idRef)}';
  }
}

class HomeScannerPage extends StatefulWidget {
  const HomeScannerPage({super.key});

  @override
  State<HomeScannerPage> createState() => _HomeScannerPageState();
}

class _HomeScannerPageState extends State<HomeScannerPage> {
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  QRViewController? _qrController;
  StreamSubscription<Barcode>? _scanSubscription;

  bool _permissaoConcedida = false;
  bool _verificandoPermissao = true;
  bool _buscandoPeca = false;
  bool _servidorOnline = false;
  Timer? _keepAliveTimer;
  final TextEditingController _codigoManualController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _solicitarPermissaoCamera();
    _acordarServidorRender();
    _keepAliveTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      _acordarServidorRender();
    });
  }

  @override
  void reassemble() {
    super.reassemble();
    if (Platform.isAndroid) {
      _qrController?.pauseCamera();
    }
    _qrController?.resumeCamera();
  }

  @override
  void dispose() {
    _keepAliveTimer?.cancel();
    _scanSubscription?.cancel();
    _codigoManualController.dispose();
    super.dispose();
  }

  Future<void> _solicitarPermissaoCamera() async {
    setState(() {
      _verificandoPermissao = true;
    });

    var status = await Permission.camera.status;
    if (!status.isGranted) {
      status = await Permission.camera.request();
    }

    if (!mounted) return;
    setState(() {
      _permissaoConcedida = status.isGranted;
      _verificandoPermissao = false;
    });
  }

  void _onQRViewCreated(QRViewController controller) {
    _qrController = controller;
    controller.resumeCamera();
    _scanSubscription?.cancel();
    _scanSubscription = controller.scannedDataStream.listen((scanData) {
      final code = scanData.code;
      if (code != null && code.trim().isNotEmpty && !_buscandoPeca) {
        _buscarEAbrirPeca(code);
      }
    });
  }

  Future<void> _acordarServidorRender() async {
    try {
      final resp = await http.get(Uri.parse('$kBackendBaseUrl/')).timeout(const Duration(seconds: 25));
      if (mounted) {
        setState(() {
          _servidorOnline = resp.statusCode >= 200 && resp.statusCode < 400;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _servidorOnline = false;
        });
      }
    }
  }

  String _extrairIdentificadorDoQr(String valorBruto) {
    final limpo = valorBruto.trim();
    if (limpo.startsWith('http://') || limpo.startsWith('https://')) {
      final uri = Uri.tryParse(limpo);
      if (uri != null) {
        if (uri.queryParameters.containsKey('id')) {
          return uri.queryParameters['id']!;
        }
        if (uri.queryParameters.containsKey('qr')) {
          return uri.queryParameters['qr']!;
        }
        if (uri.queryParameters.containsKey('codigo')) {
          return uri.queryParameters['codigo']!;
        }
        if (uri.pathSegments.isNotEmpty) {
          return uri.pathSegments.last;
        }
      }
    }
    return limpo;
  }

  Future<void> _buscarEAbrirPeca(String valorLido) async {
    if (_buscandoPeca) return;
    final identificador = _extrairIdentificadorDoQr(valorLido).replaceAll('#', '').trim();
    if (identificador.isEmpty) return;

    setState(() {
      _buscandoPeca = true;
    });

    try {
      PecaModel? pecaEncontrada;

      try {
        final respDireta = await http
            .get(Uri.parse('$kBackendBaseUrl/pecas/${Uri.encodeComponent(identificador)}'))
            .timeout(const Duration(seconds: 15));

        if (respDireta.statusCode == 200) {
          final data = jsonDecode(respDireta.body);
          if (data is Map<String, dynamic> && (data['_id'] != null || data['id'] != null)) {
            pecaEncontrada = PecaModel.fromJson(data);
          }
        }
      } catch (_) {}

      if (pecaEncontrada == null) {
        final respLista = await http
            .get(Uri.parse('$kBackendBaseUrl/pecas'))
            .timeout(const Duration(seconds: 20));

        if (respLista.statusCode == 200) {
          final List<dynamic> lista = jsonDecode(respLista.body);
          final buscaLower = identificador.toLowerCase();

          for (final item in lista) {
            if (item is Map<String, dynamic>) {
              final idMongo = (item['_id'] ?? '').toString().trim().toLowerCase();
              final cod = (item['id'] ?? '').toString().replaceAll(',', '').trim().toLowerCase();
              final codOriginal = (item['id'] ?? '').toString().trim().toLowerCase();
              final token = (item['qrToken'] ?? '').toString().trim().toLowerCase();

              if (idMongo == buscaLower ||
                  cod == buscaLower ||
                  codOriginal == buscaLower ||
                  token == buscaLower) {
                pecaEncontrada = PecaModel.fromJson(item);
                break;
              }
            }
          }

          if (pecaEncontrada == null) {
            for (final item in lista) {
              if (item is Map<String, dynamic>) {
                final nome = (item['nome'] ?? '').toString().trim().toLowerCase();
                if (nome.contains(buscaLower)) {
                  pecaEncontrada = PecaModel.fromJson(item);
                  break;
                }
              }
            }
          }
        }
      }

      if (!mounted) return;

      if (pecaEncontrada != null) {
        setState(() {
          _buscandoPeca = false;
        });

        try {
          await _qrController?.pauseCamera();
        } catch (_) {}

        if (!mounted) return;
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => DetalheSimplificadoPecaPage(peca: pecaEncontrada!),
          ),
        );

        try {
          await _qrController?.resumeCamera();
        } catch (_) {}
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text('Peça "$identificador" não encontrada no estoque.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.orange,
            content: Text('Erro ao buscar peça: verifique a conexão ($e).'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _buscandoPeca = false;
        });
      }
    }
  }

  Future<void> _abrirTelaCadastroPeca() async {
    try {
      await _qrController?.pauseCamera();
    } catch (_) {}

    if (!mounted) return;
    final PecaModel? novaPecaCriada = await Navigator.of(context).push<PecaModel>(
      MaterialPageRoute(
        builder: (_) => const CadastrarPecaMobilePage(),
      ),
    );

    if (!mounted) return;
    if (novaPecaCriada != null) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DetalheSimplificadoPecaPage(peca: novaPecaCriada),
        ),
      );
    }

    try {
      await _qrController?.resumeCamera();
    } catch (_) {}
  }

  void _abrirBuscaManualModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Buscar Peça por Código ou Nome',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFFFFC300)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _codigoManualController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Digite o código ou nome (Ex: 19)',
                  filled: true,
                  fillColor: Colors.black26,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onSubmitted: (val) {
                  Navigator.pop(ctx);
                  _buscarEAbrirPeca(val);
                },
              ),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFC300),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: () {
                  final texto = _codigoManualController.text;
                  Navigator.pop(ctx);
                  _buscarEAbrirPeca(texto);
                },
                icon: const Icon(Icons.search),
                label: const Text('Consultar Peça', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAreaCamera() {
    if (_verificandoPermissao) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFFFC300)),
      );
    }

    if (!_permissaoConcedida) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.camera_alt_outlined, color: Color(0xFFFFC300), size: 56),
              const SizedBox(height: 12),
              const Text(
                'Permissão de Câmera Necessária',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Toque no botão abaixo para liberar a câmera e ler o QR Code das peças.',
                style: TextStyle(fontSize: 13, color: Colors.white70),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFC300),
                  foregroundColor: Colors.black,
                ),
                onPressed: () async {
                  final status = await Permission.camera.request();
                  if (status.isPermanentlyDenied) {
                    await openAppSettings();
                  } else {
                    await _solicitarPermissaoCamera();
                  }
                },
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Liberar Câmera Agora'),
              ),
            ],
          ),
        ),
      );
    }

    return QRView(
      key: qrKey,
      onQRViewCreated: _onQRViewCreated,
      formatsAllowed: const [BarcodeFormat.qrcode],
      overlay: QrScannerOverlayShape(
        borderColor: const Color(0xFFFFC300),
        borderRadius: 16,
        borderLength: 36,
        borderWidth: 8,
        cutOutSize: 250,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Canada Auto Peças', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text('Scanner QR & Cadastro Rápido', style: TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _servidorOnline ? Colors.green.withOpacity(0.2) : Colors.orange.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _servidorOnline ? Colors.greenAccent : Colors.orangeAccent),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.bolt,
                  size: 15,
                  color: _servidorOnline ? Colors.greenAccent : Colors.orangeAccent,
                ),
                const SizedBox(width: 4),
                Text(
                  _servidorOnline ? 'Online' : 'Acordando...',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _servidorOnline ? Colors.greenAccent : Colors.orangeAccent,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Lanterna',
            icon: const Icon(Icons.flash_on),
            onPressed: () async {
              try {
                await _qrController?.toggleFlash();
              } catch (_) {}
            },
          ),
          IconButton(
            tooltip: 'Virar Câmera',
            icon: const Icon(Icons.cameraswitch),
            onPressed: () async {
              try {
                await _qrController?.flipCamera();
              } catch (_) {}
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          _buildAreaCamera(),
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.qr_code_scanner, color: Color(0xFFFFC300)),
                      SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          'Aponte para o QR Code da peça ou use os botões abaixo',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFFC300),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: _abrirBuscaManualModal,
                        icon: const Icon(Icons.search),
                        label: const Text(
                          'Buscar Código',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF27AE60),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: _abrirTelaCadastroPeca,
                        icon: const Icon(Icons.add_a_photo),
                        label: const Text(
                          'Cadastrar Peça',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_buscandoPeca)
            Container(
              color: Colors.black87,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Color(0xFFFFC300)),
                    SizedBox(height: 16),
                    Text(
                      'Carregando dados da peça...',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ============================================================================
// TELA PARA CADASTRAR NOVA PEÇA DIRETO PELO CELULAR COM FOTOS DA GALERIA/CÂMERA
// ============================================================================
class CadastrarPecaMobilePage extends StatefulWidget {
  const CadastrarPecaMobilePage({super.key});

  @override
  State<CadastrarPecaMobilePage> createState() => _CadastrarPecaMobilePageState();
}

class _CadastrarPecaMobilePageState extends State<CadastrarPecaMobilePage> {
  final _formKey = GlobalKey<FormState>();
  final _codigoCtrl = TextEditingController();
  final _nomeCtrl = TextEditingController();
  final _marcaCtrl = TextEditingController();
  final _estoqueCtrl = TextEditingController(text: '1');
  final _precoCtrl = TextEditingController();
  final _localizacaoCtrl = TextEditingController();

  final ImagePicker _picker = ImagePicker();
  final List<XFile> _fotosSelecionadas = [];
  bool _salvando = false;

  static const List<String> _marcasSugeridas = [
    'Chevrolet',
    'Fiat',
    'Ford',
    'Volkswagen',
    'Toyota',
    'Honda',
    'Hyundai',
    'Renault',
    'Jeep',
    'Nissan',
    'Peugeot',
    'Citroën',
    'Mitsubishi',
    'Mercedes-Benz',
    'BMW',
    'Audi',
    'Kia',
    'Chery'
  ];

  @override
  void dispose() {
    _codigoCtrl.dispose();
    _nomeCtrl.dispose();
    _marcaCtrl.dispose();
    _estoqueCtrl.dispose();
    _precoCtrl.dispose();
    _localizacaoCtrl.dispose();
    super.dispose();
  }

  Future<void> _selecionarFotosDaGaleria() async {
    if (_fotosSelecionadas.length >= 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Limite máximo de 4 fotos por peça.')),
      );
      return;
    }
    try {
      final List<XFile> escolhidas = await _picker.pickMultiImage(
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 75,
      );
      if (escolhidas.isNotEmpty) {
        setState(() {
          for (final f in escolhidas) {
            if (_fotosSelecionadas.length < 4) {
              _fotosSelecionadas.add(f);
            }
          }
        });
      }
    } catch (e) {
      // Fallback caso o aparelho não suporte multi-seleção nativa: abre seleção de 1 foto
      try {
        final XFile? unica = await _picker.pickImage(
          source: ImageSource.gallery,
          maxWidth: 1024,
          maxHeight: 1024,
          imageQuality: 75,
        );
        if (unica != null) {
          setState(() {
            _fotosSelecionadas.add(unica);
          });
        }
      } catch (err) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Não foi possível abrir a galeria: $err')),
          );
        }
      }
    }
  }

  Future<void> _tirarFotoComCamera() async {
    if (_fotosSelecionadas.length >= 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Limite máximo de 4 fotos por peça.')),
      );
      return;
    }
    try {
      final XFile? foto = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 75,
      );
      if (foto != null) {
        setState(() {
          _fotosSelecionadas.add(foto);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Não foi possível tirar a foto: $e')),
        );
      }
    }
  }

  Future<void> _salvarNovaPeca() async {
    if (!_formKey.currentState!.validate()) return;

    final codigo = _codigoCtrl.text.trim();
    final nome = _nomeCtrl.text.trim();
    final marca = _marcaCtrl.text.trim();
    final estoque = _estoqueCtrl.text.trim().isEmpty ? '1' : _estoqueCtrl.text.trim();
    final preco = _precoCtrl.text.trim().replaceAll(',', '.');
    final localizacao = _localizacaoCtrl.text.trim();

    setState(() {
      _salvando = true;
    });

    try {
      final uri = Uri.parse('$kBackendBaseUrl/pecas');
      final request = http.MultipartRequest('POST', uri);

      request.fields['id'] = codigo;
      request.fields['nome'] = nome;
      request.fields['marca'] = marca;
      request.fields['estoque'] = estoque;
      request.fields['preco'] = preco.isEmpty ? '0' : preco;
      request.fields['localizacao'] = localizacao;

      for (final xfile in _fotosSelecionadas) {
        request.files.add(
          await http.MultipartFile.fromPath('imagens', xfile.path),
        );
      }

      final streamedResp = await request.send().timeout(const Duration(seconds: 45));
      final resp = await http.Response.fromStream(streamedResp);

      if (!mounted) return;

      if (resp.statusCode == 200 || resp.statusCode == 201) {
        final jsonCriado = jsonDecode(resp.body) as Map<String, dynamic>;
        final pecaCriada = PecaModel.fromJson(jsonCriado);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.green,
            content: Text('Peça cadastrada com sucesso no estoque!'),
          ),
        );
        Navigator.of(context).pop(pecaCriada);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text('Erro ao salvar peça (Status ${resp.statusCode}).'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.orange,
            content: Text('Erro de conexão ao enviar peça: $e'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _salvando = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cadastrar Nova Peça'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Seção de Fotos da Galeria / Câmera Nativa do Celular
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Fotos do Produto (Até 4 fotos)',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFFFFC300)),
                        ),
                        Text(
                          '${_fotosSelecionadas.length}/4',
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Escolha fotos da Galeria do celular ou tire foto na hora. A 1ª foto será a Capa.',
                      style: TextStyle(fontSize: 12, color: Colors.white60),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFFFC300),
                              foregroundColor: Colors.black,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: _selecionarFotosDaGaleria,
                            icon: const Icon(Icons.photo_library),
                            label: const Text('Abrir Galeria', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white54),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: _tirarFotoComCamera,
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Tirar Foto'),
                          ),
                        ),
                      ],
                    ),
                    if (_fotosSelecionadas.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      SizedBox(
                        height: 110,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _fotosSelecionadas.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 10),
                          itemBuilder: (_, idx) {
                            return Stack(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: Image.file(
                                    File(_fotosSelecionadas[idx].path),
                                    width: 110,
                                    height: 110,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                                if (idx == 0)
                                  Positioned(
                                    bottom: 4,
                                    left: 4,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFFC300),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'CAPA',
                                        style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ),
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        _fotosSelecionadas.removeAt(idx);
                                      });
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: const BoxDecoration(
                                        color: Colors.red,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.close, size: 16, color: Colors.white),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Campos do Produto
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: _codigoCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Código da Peça *',
                        hintText: 'Ex: 125',
                        filled: true,
                        fillColor: Color(0xFF1E1E1E),
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o código' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _estoqueCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Estoque',
                        filled: true,
                        fillColor: Color(0xFF1E1E1E),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _nomeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Nome / Descrição da Peça *',
                  hintText: 'Ex: Parachoque Traseiro Gol G5',
                  filled: true,
                  fillColor: Color(0xFF1E1E1E),
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Informe o nome da peça' : null,
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _marcaCtrl,
                      decoration: InputDecoration(
                        labelText: 'Marca / Montadora',
                        hintText: 'Ex: Chevrolet',
                        filled: true,
                        fillColor: const Color(0xFF1E1E1E),
                        border: const OutlineInputBorder(),
                        suffixIcon: PopupMenuButton<String>(
                          icon: const Icon(Icons.arrow_drop_down),
                          onSelected: (val) => _marcaCtrl.text = val,
                          itemBuilder: (_) => _marcasSugeridas
                              .map((m) => PopupMenuItem(value: m, child: Text(m)))
                              .toList(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _precoCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Preço (R\$)',
                        hintText: 'Ex: 250,00',
                        filled: true,
                        fillColor: Color(0xFF1E1E1E),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              TextFormField(
                controller: _localizacaoCtrl,
                decoration: const InputDecoration(
                  labelText: 'Localização (Corredor / Prateleira)',
                  hintText: 'Ex: Telhado / Prateleira B2',
                  filled: true,
                  fillColor: Color(0xFF1E1E1E),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF27AE60),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _salvando ? null : _salvarNovaPeca,
                icon: _salvando
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : const Icon(Icons.check_circle),
                label: Text(
                  _salvando ? 'Enviando Fotos e Salvando...' : 'Salvar Peça no Estoque',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DetalheSimplificadoPecaPage extends StatefulWidget {
  final PecaModel peca;

  const DetalheSimplificadoPecaPage({super.key, required this.peca});

  @override
  State<DetalheSimplificadoPecaPage> createState() => _DetalheSimplificadoPecaPageState();
}

class _DetalheSimplificadoPecaPageState extends State<DetalheSimplificadoPecaPage> {
  int _fotoAtualIndex = 0;

  Future<void> _compartilharWhatsAppCliente() async {
    final p = widget.peca;
    final marcaTxt = p.marca.isNotEmpty ? ' (${p.marca.toUpperCase()})' : '';
    final mensagem = 'Confira ${p.nome}$marcaTxt - Cód. #${p.codigo} por ${p.precoFormatado}. Encontre na Canada Auto Peças agora!\n${p.linkCompartilhamentoCliente}';

    final whatsappUri = Uri.parse('https://api.whatsapp.com/send?text=${Uri.encodeComponent(mensagem)}');
    if (await canLaunchUrl(whatsappUri)) {
      await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
    } else {
      await Share.share(mensagem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.peca;

    return Scaffold(
      appBar: AppBar(
        title: Text('Código #${p.codigo}'),
        actions: [
          IconButton(
            tooltip: 'Compartilhar link com cliente',
            icon: const Icon(Icons.share),
            onPressed: () {
              Share.share(
                'Confira ${p.nome} - Cód. #${p.codigo} por ${p.precoFormatado}. Encontre na Canada Auto Peças agora!\n${p.linkCompartilhamentoCliente}',
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 270,
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white12),
              ),
              clipBehavior: Clip.antiAlias,
              child: p.fotos.isNotEmpty
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        PageView.builder(
                          itemCount: p.fotos.length,
                          onPageChanged: (idx) => setState(() => _fotoAtualIndex = idx),
                          itemBuilder: (_, idx) {
                            return Image.network(
                              p.fotos[idx],
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Center(
                                child: Icon(Icons.broken_image, size: 60, color: Colors.white38),
                              ),
                            );
                          },
                        ),
                        if (p.fotos.length > 1)
                          Positioned(
                            bottom: 10,
                            right: 12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                'Foto ${_fotoAtualIndex + 1} de ${p.fotos.length}',
                                style: const TextStyle(fontSize: 12, color: Color(0xFFFFC300)),
                              ),
                            ),
                          ),
                      ],
                    )
                  : const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.image_not_supported_outlined, size: 54, color: Colors.white38),
                          SizedBox(height: 8),
                          Text('Sem foto cadastrada', style: TextStyle(color: Colors.white54)),
                        ],
                      ),
                    ),
            ),
            const SizedBox(height: 16),
            Text(
              p.nome,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(14),
                border: const Border(left: BorderSide(color: Color(0xFFFFC300), width: 5)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'PREÇO DE VENDA',
                        style: TextStyle(fontSize: 12, color: Colors.white60, letterSpacing: 1),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        p.precoFormatado,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFFFC300),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: p.estoque > 0 ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: p.estoque > 0 ? Colors.greenAccent : Colors.redAccent),
                    ),
                    child: Text(
                      '${p.estoque} un. em estoque',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: p.estoque > 0 ? Colors.greenAccent : Colors.redAccent,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildInfoTile(Icons.location_on, 'Localização no Estoque', p.localizacao, destaque: true),
            const SizedBox(height: 10),
            _buildInfoTile(Icons.directions_car, 'Marca / Montadora', p.marca),
            const SizedBox(height: 10),
            _buildInfoTile(Icons.tag, 'Código da Peça', '#${p.codigo}'),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF25D366),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _compartilharWhatsAppCliente,
              icon: const Icon(Icons.send),
              label: const Text(
                'Enviar Anúncio ao Cliente no WhatsApp',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFFFC300),
                side: const BorderSide(color: Color(0xFFFFC300)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Voltar para o Scanner QR', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String label, String valor, {bool destaque = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: destaque ? const Color(0xFFFFC300).withOpacity(0.12) : const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: destaque ? const Color(0xFFFFC300).withOpacity(0.5) : Colors.white10,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFFFFC300), size: 26),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: Colors.white60)),
                const SizedBox(height: 2),
                Text(
                  valor,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
