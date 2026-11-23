# Agenda Inteligente

Aplicativo web progressivo (PWA) em português, pensado para uso no celular Android e desktop.

## Estado atual

Esta é uma versão inicial funcional para testes individuais. Ela não é um aplicativo Android nativo/APK.

### Funcionalidades disponíveis
- Painel inicial com resumo de compromissos, contas pendentes, despesas do mês e cartões cadastrados.
- Cadastro de compromissos com data e horário.
- Cadastro de contas e compras parceladas, gerando parcelas mensais automaticamente.
- Cadastro de cartões com limite, fechamento e vencimento informativos.
- Marcação de parcelas como pagas.
- Exclusão de compromissos, grupos de parcelas e cartões.
- Backup dos dados em arquivo JSON e restauração de backup.
- Instalação como PWA quando publicada em HTTPS e suporte básico offline.

## Armazenamento e privacidade

**Os dados ficam apenas no armazenamento local do navegador (localStorage) deste aparelho e perfil de navegador.** Não há servidor, login ou sincronização nesta versão. Se o usuário limpar os dados do navegador, perder o aparelho ou usar outro navegador, os registros podem não estar disponíveis. Faça backups regulares e guarde-os em local seguro.

Não cadastre senhas bancárias, números completos de cartões, documentos pessoais ou outras informações altamente confidenciais nesta versão.

## Limitações conhecidas

- Não há autenticação por e-mail ou Google.
- Não há sincronização em nuvem nem compartilhamento familiar.
- Não há perfis, convites, papéis ou permissões.
- Não há notificações agendadas em segundo plano.
- O fechamento e vencimento do cartão são exibidos como dados informativos; as parcelas ainda não são calculadas conforme o ciclo real da fatura.
- O registro de compras parceladas cria parcelas mensais a partir do primeiro vencimento informado.
- O limite disponível é uma estimativa simples baseada nas parcelas não pagas cadastradas, não uma integração com o banco ou emissor do cartão.

## Publicar com GitHub Pages

1. Abra **Settings → Pages** no repositório.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Escolha a branch **main** e a pasta **/(root)**.
4. Clique em **Save** e aguarde a publicação.
5. O endereço esperado é `https://swagtop411-max.github.io/Agenda-inteligente/`.

No Android, abra o endereço no Chrome e use o menu do navegador para **Instalar app** ou **Adicionar à tela inicial** (a opção pode variar conforme o aparelho).

## Próximas etapas de desenvolvimento

1. Criar backend e banco de dados com regras de acesso por usuário.
2. Implementar login, recuperação de senha e sincronização.
3. Implementar família compartilhada com privacidade por registro e permissões.
4. Desenvolver cálculo de faturas por data de fechamento e vencimento.
5. Implementar notificações e lembretes confiáveis.
6. Criar testes automatizados e avaliar empacotamento Android nativo.

## Desenvolvimento

O projeto é estático: `index.html`, `styles.css` e `app.js`. O GitHub Actions valida a sintaxe do JavaScript e o JSON do manifesto em cada alteração.
