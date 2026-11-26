# App Scanner QR Code - Canada Auto Peças (Flutter Android)

Aplicativo Android desenvolvido em Flutter para leitura instantânea dos QR Codes gerados no sistema da **Canada Auto Peças**.

## Funcionalidades
- **Leitor de QR Code Rápido (`mobile_scanner`)**: Ao apontar a câmera para a etiqueta da peça, já busca e abre a ficha simplificada na hora.
- **Informações Simplificadas**: Mostra Fotos, Preço em destaque, Quantidade em Estoque, Localização (Prateleira/Corredor), Marca e Código.
- **Compartilhamento Rápido com o Cliente**: Botão para enviar o link público da peça (com foto e preço) direto para o WhatsApp do cliente.
- **Keep-Alive Integrado**: Mantém o servidor do Render acordado enquanto o aplicativo está em uso.
- **Busca Manual**: Permite digitar o código da peça caso a etiqueta esteja danificada.

## Como compilar o APK para Android
Se já tiver o Flutter SDK instalado na máquina:
```bash
cd app_scanner_autopecas
flutter create .
flutter pub get
flutter build apk --release
```
O arquivo instalável `.apk` será gerado em `build/app/outputs/flutter-apk/app-release.apk`.
