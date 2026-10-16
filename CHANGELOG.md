# Mudanças do Etilômetro

## 2026-10-16
- **Login novo da Central** (`SGE.acesso.entrar` do sge-core) no lugar do `sso_client.js`. O sistema só abre com a sessão real de quem entrou; sem ela, vai para o login da Central. Erro de rede não deixa entrar.
- O banco é lido e gravado **com a sessão da pessoa** (uma conexão só, a mesma do login), e não mais como anônimo. Prepara o fechamento da leitura sem login das tabelas gps_mec (P-035).
- Saíram o login local e o `sge-session-ping.js` (o radar da Central agora vem do sge-core).

## 2026-10-04
- Radar de presença passa a usar o arquivo oficial da Central (v2). Agora o sistema também expulsa usuário bloqueado, acesso revogado e sistema em manutenção (confere a cada 5 minutos).
- A cópia antiga `js/sge-session-ping.js` (v1.0.1) ficou no projeto só para voltar atrás, se precisar. Não é mais carregada.
