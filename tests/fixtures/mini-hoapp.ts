/** 1x1 PNG */
export const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

export const MINI_HOAPP_DATA_JS = `
const { SectionEditable, VideoEditable } = HoApp;
const iCourse = {
	id: 1,
	title: \`Mini curso Atletismo\`,
	code: \`TST\`,
	language: \`pt\`,
};
const cvid = new VideoEditable(
	'vid1',
	{
  "version": 2,
  "required": true,
  "videoType": "VIMEO",
  "path": "https://player.vimeo.com/video/1",
  "title": "Intro"
},
);
const sections = [];
sections.push(
	new SectionEditable(
		'tela_01',
		{
			position: 1,
			content: \`
<p>Hello</p>
<img src="midias/imagens/foto.png" alt="foto">
<p>World</p>
<as-video id="vid1"></as-video>
<a onclick="window.open('midias/docs/a.pdf')">Atividade</a>
<div class="desktop-only"><p>Duplicado</p></div>
<div class="mobile-only"><p>Duplicado</p></div>
\`,
			components: [cvid],
		}
	)
);
`;

export const MINI_QUIZ_DATA_JS = `
const { SectionEditable, Question } = HoApp;
const iCourse = { title: \`Quiz mini\`, code: \`Q\`, language: \`pt\` };
const cq1 = new Question(
	'q1',
	{
  "question": "Qual é a capital?",
  "choices": [
    { "text": "São Paulo", "status": "incorrect" },
    { "text": "Brasília", "status": "correct" },
    { "text": "Rio", "status": "incorrect" }
  ]
},
);
const sections = [];
sections.push(
	new SectionEditable(
		'tela_quiz',
		{
			position: 1,
			content: \`<h2>Avaliação</h2><as-question id="q1"></as-question>\`,
			components: [cq1],
		}
	)
);
`;
