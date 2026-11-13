# The Barber Experience — barbershop-premium

Site premium de barbearia com experiência 3D (navalha, tesoura, barber pole e cadeira em Three.js), agendamento real e área administrativa.

- **Hospedagem:** Firebase Hosting (projeto `barbershop-premium-dk`)
- **Banco de dados:** Cloud Firestore
- **Login do painel:** Firebase Authentication (e-mail e senha)

## Estrutura

```
src/                código-fonte (edite aqui)
  body.html         marcação das seções
  styles.css        estilos
  app.js            interface, agendamento, animações de página
  stage.js          cena 3D e coreografia por scroll
  models.js         modelos 3D procedurais
  data.js           motor de disponibilidade e escolha do backend
  firebase-store.js backend Firebase (Firestore + Auth)
  admin.js          área administrativa
  img/              fotos (Unsplash, licença livre — trocar pelas reais)
public/             site pronto para publicar (gerado pelo build)
build.py            gera public/ a partir de src/
firestore.rules     regras de segurança do banco
firebase.json       configuração do Hosting e do Firestore
```

Depois de editar algo em `src/`, rode `python3 build.py` para atualizar `public/`.

## Primeira publicação (uma vez só)

1. **Firebase Console → barbershop-premium-dk**
   - **Build → Firestore Database → Criar banco de dados** (modo produção, região `southamerica-east1`).
   - **Build → Authentication → Começar → Método de login → E-mail/senha → Ativar**.
   - **Configurações do projeto → Seus apps → Adicionar app → Web** (qualquer apelido). Não precisa copiar o código: o Hosting entrega a configuração automaticamente.
2. No computador:
   ```bash
   git clone https://github.com/landoraag-comm/barbershop-premium.git
   cd barbershop-premium
   npm install -g firebase-tools   # se ainda não tiver
   firebase login
   firebase deploy
   ```
   O `firebase deploy` publica o site **e** as regras do Firestore.
3. **Logo em seguida**, abra `https://barbershop-premium-dk.web.app/#admin` e crie o acesso do responsável (e-mail + senha). O primeiro cadastro vira o dono do painel; depois disso ninguém mais consegue se cadastrar como administrador.

## Atualizações

```bash
git pull
firebase deploy
```

## Como funciona o agendamento

- O cliente escolhe serviço, profissional, data e horário; só aparecem horários que cabem inteiros no expediente, fora de pausas, bloqueios e reservas existentes.
- A reserva grava, numa única operação, o horário público (`slots`), os dados do cliente (`bookings`, visíveis só para administradores) e um "cadeado" para cada bloco de 5 minutos ocupado (`locks`).
- As regras do Firestore só permitem **criar** cadeados, nunca sobrescrever. Se duas pessoas tentarem o mesmo horário ao mesmo tempo, a segunda é recusada pelo servidor e o site pede outro horário.
- O WhatsApp é só para enviar o resumo; a reserva já está registrada antes disso.

## Área administrativa (`/#admin` ou link no rodapé)

Visão geral com indicadores, agenda por dia com filtro por profissional, cancelamento e reserva manual, serviços e preços, profissionais (com foto), horários, bloqueios, dados da barbearia, fotos do espaço e troca de senha.

## Imagens

As fotos em `src/img/` são do Unsplash (uso livre sob a Licença Unsplash) e aparecem marcadas como "Imagem ilustrativa". Para usar fotos reais, envie pelo painel (Profissionais e Estabelecimento) — elas substituem as ilustrativas automaticamente.
