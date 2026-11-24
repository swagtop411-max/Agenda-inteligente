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
- Instalação como PWA quando publicada em HTTPS, manifesto com ícones vetoriais e suporte básico offline.

## Armazenamento e privacidade

**Os dados ficam apenas no armazenamento local do navegador (localStorage) deste aparelho e perfil de navegador.** Não há servidor, login ou sincronização nesta versão. Se o usuário limpar os dados do navegador, perder o aparelho ou usar outro navegador, os registros podem não estar disponíveis. Faça backups regulares e guarde-os em local seguro.

Não cadastre senhas bancárias, números completos de cartões, documentos pessoais ou outras informações altamente confidenciais nesta versão.

## Recursos financeiros recentes

- O histórico de pagamentos de dívidas permite corrigir ou excluir um pagamento; ao excluir, o valor retorna ao saldo em aberto.
- A inclusão de um pagamento de dívida no fluxo de caixa alerta quando já existe uma despesa com a mesma data e valor.
- A visão **Compromissos futuros** resume, para seis meses a partir do mês selecionado, receitas cadastradas e despesas pendentes, com resultado previsto por mês.
- As previsões consideram somente os registros informados no aplicativo e não representam saldo bancário nem consulta a instituições financeiras.

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

No Android, abra o endereço no Chrome e use o botão **Instalar** do aplicativo ou o menu do navegador para **Instalar app** / **Adicionar à tela inicial** (a opção pode variar conforme o aparelho). O projeto inclui ícones SVG escaláveis, inclusive uma versão maskable. A instalação ainda deve ser validada em aparelhos reais.

## Próximas etapas de desenvolvimento

1. Criar backend e banco de dados com regras de acesso por usuário.
2. Validar autenticação, URLs de redirecionamento, sincronização, exclusões e migração no dispositivo real.
3. Finalizar família compartilhada com privacidade por registro e permissões.
4. Desenvolver cálculo de faturas por data de fechamento e vencimento.
5. Implementar notificações e lembretes confiáveis.
6. Criar testes automatizados e avaliar empacotamento Android nativo.

## Desenvolvimento

O projeto é estático: `index.html`, `styles.css` e `app.js`. O GitHub Actions valida a sintaxe do JavaScript e o JSON do manifesto em cada alteração.


## Backend Supabase (preparação inicial)

O esquema inicial do banco está em `supabase/schema.sql`. Ele cria tabelas para compromissos, cartões, contas/parcelas, receitas, orçamentos, dívidas e pagamentos de dívidas.

- Todas as tabelas têm `user_id` ligado a `auth.users`.
- Row Level Security (RLS) fica habilitado em todas as tabelas.
- As políticas permitem operações somente para o usuário autenticado dono dos registros.
- Nenhuma chave secreta ou dado pessoal de backup é armazenado neste repositório.

**Estado:** esquema executado e verificado no projeto Supabase: as sete tabelas existem e RLS está ativado em todas. O front-end agora inclui tela de conta, cadastro/login por e-mail, recuperação de senha, opção de OAuth Google (depende da configuração do provedor no Supabase) e sincronização inicial/por alterações com o banco. A primeira sincronização combina registros locais e remotos por ID e mantém o backup local. Exclusões offline ainda não são propagadas automaticamente; mantenha backups e use a sincronização manual para buscar registros de outros dispositivos.
