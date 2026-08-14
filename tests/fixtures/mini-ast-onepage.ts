export const MINI_IMS_MANIFEST = `<?xml version="1.0"?>
<manifest>
  <organizations default="TST">
    <organization identifier="TST">
      <title>Mini AST</title>
    </organization>
  </organizations>
</manifest>
`;

export const MINI_AST_INDEX = `<!doctype html>
<html lang="pt">
<head><title>Curso AST Mini</title></head>
<body>
<script>window.location="./resources/m1/index.html";</script>
</body>
</html>
`;

export const MINI_AST_CONTENT = `<!doctype html>
<html lang="pt">
<head><title>Curso AST Mini</title></head>
<body>
<nav class="navigation">Chrome menu</nav>
<div id="c1" class="container">
  <h1>Introdução</h1>
  <img src="./images/foto.png" alt="foto">
  <img src="./images/logo_comite.png" alt="logo">
  <img src="../interface/nav.png" alt="nav">
  <div class="flipcard">
    <div class="front"><h3>Frente do card</h3></div>
    <div class="back"><p>Texto do verso do flip-card</p></div>
  </div>
</div>
<div id="c2" class="container">
  <p>Assista ao vídeo</p>
  <video id="video" poster="./videos/aula_poster.jpg">
    <source src="./videos/aula.mp4" type="video/mp4" />
  </video>
  <button onclick="newPopup('imagem','./images/c13-popup.png')">Saiba mais</button>
  <a onclick="window.open('./docs/guia.pdf')">Download</a>
</div>
<div class="popup" id="pop-media">
  <video><source src="" type="video/mp4" /></video>
</div>
</body>
</html>
`;

export const MINI_AST_QUIZ_JSON = JSON.stringify({
  initial_screen: {
    title: "Quiz final",
    text: "Vamos testar seus conhecimentos?",
    image_url: "./quiz/images/capa.jpg",
    button_label: "Iniciar",
  },
  questions: [
    {
      title: "Pergunta 1",
      image_url: "",
      description: "Qual é a capital?",
      type: "multiple_choice",
      positive_feedback_title: "Parabéns",
      positive_feedback_text: "Resposta correta.",
      negative_feedback_title: "Ops",
      negative_feedback_text: "Tente de novo.",
      right_answer: "B",
      options: [
        { label: "A) São Paulo", value: "A" },
        { label: "B) Brasília", value: "B" },
      ],
    },
  ],
});
