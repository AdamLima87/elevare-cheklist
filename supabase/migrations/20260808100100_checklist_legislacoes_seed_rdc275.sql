-- Fase 7.2 — seed determinístico da RDC 275/2002 (migração do conteúdo
-- hardcoded em src/lib/checklist-data.ts pra estrutura de banco da Fase 7.1).
-- Gerado por scripts/gerar-seed-checklist-rdc275.mjs — não editar à mão;
-- se o conteúdo do checklist mudar, rode o script de novo e substitua
-- este arquivo por uma NOVA migration (esta versão, uma vez publicada,
-- é imutável por construção — ver trigger da Fase 7.1).
-- UUIDs são determinísticos (UUIDv5 sobre a chave natural de cada
-- registro) — ON CONFLICT DO NOTHING torna esta migration idempotente.

INSERT INTO public.legislacoes (id, codigo, nome, esfera, uf, ativo) VALUES
  ('31396eb5-88c1-5427-8697-8e94d4ccd1f3', 'RDC_275_2002', 'RDC nº 275/2002 - ANVISA', 'federal', NULL, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.legislacao_versoes (id, legislacao_id, numero_versao, descricao, vigente_desde, ativo) VALUES
  ('b5b3506a-e6ac-54d6-bc94-6c26d22aae0d', '31396eb5-88c1-5427-8697-8e94d4ccd1f3', 1, 'Texto original da RDC 275/2002', NULL, true)
ON CONFLICT (legislacao_id, numero_versao) DO NOTHING;

INSERT INTO public.checklist_modelos (id, legislacao_versao_id, codigo, nome, ativo) VALUES
  ('5786ec19-3657-55b7-82c0-5c505d2190bf', 'b5b3506a-e6ac-54d6-bc94-6c26d22aae0d', 'RDC_275_2002_PADRAO', 'Checklist RDC 275/2002 - Padrão RDCheck', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.checklist_modelo_versoes (id, modelo_id, numero_versao, is_versao_atual, publicado_em, ativo) VALUES
  ('b64f185c-73b4-5acf-a931-a2f8a4800114', '5786ec19-3657-55b7-82c0-5c505d2190bf', 1, true, now(), true)
ON CONFLICT (modelo_id, numero_versao) DO NOTHING;

INSERT INTO public.checklist_secoes (id, modelo_versao_id, secao_key, titulo, ordem) VALUES
  ('c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'instalacoes', 'Instalações', 1),
  ('fb20fa55-598e-5bf8-9c84-e5eb5048e155', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'equipamentos', 'Equipamentos, móveis e utensílios', 2),
  ('f81ad737-1c5d-5b2e-a761-7026ba1ec573', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'higienizacao', 'Higienização de instalações, equipamentos, móveis e utensílios', 3),
  ('eec23e71-61ec-5628-914d-a6eb0dbe924e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'pragas', 'Controle integrado de vetores e pragas urbanas', 4),
  ('ed6b2527-6044-5ad9-a713-a51372ca93b7', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'agua', 'Abastecimento de água', 5),
  ('1c6b9b2b-23a4-5bf2-a003-7f637f81bfce', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'residuos', 'Manejo dos resíduos', 6),
  ('0b67f8ca-d1bf-528e-8052-895ca3a132ce', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'manipuladores', 'Manipuladores', 7),
  ('0b6b3b8b-5cee-5f72-b4fc-309d74562e31', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'materias-primas', 'Matérias-primas, ingredientes e embalagens', 8),
  ('01533bea-6b1b-569c-8ced-c9424e3256a3', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'preparacao', 'Preparação do alimento', 9),
  ('c2cc4d2c-5084-50b6-97ce-b62b0be62615', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'armazenamento', 'Armazenamento e transporte do alimento preparado', 10),
  ('e8f6908a-a932-5133-850e-5c3222c15701', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'exposicao', 'Exposição ao consumo do alimento preparado', 11),
  ('fb346679-9265-549a-b5fe-5a9807b6d26c', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'documentacao', 'Documentação e registro', 12)
ON CONFLICT (modelo_versao_id, secao_key) DO NOTHING;

INSERT INTO public.checklist_itens (id, modelo_versao_id, secao_id, item_key, texto, critico, ordem) VALUES
  ('6985e19a-7bd0-5810-89f9-a815d7619cd4', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '1', 'Área externa livre de focos de insalubridade, objetos em desuso, animais e insetos.', false, 1),
  ('09758dde-b4d6-54cc-95a4-186c508c812b', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '2', 'Acesso direto e independente, não comum a outros usos (habitação).', false, 2),
  ('1b56c7ab-152a-578a-9ecf-b55a3a430bab', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '3', 'Fluxo ordenado, sem cruzamento de etapas e atividades.', false, 3),
  ('259deca6-dafb-5a14-ba1a-45e5ec3d006f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '4', 'Separação adequada das diferentes atividades por meios físicos ou técnicos.', false, 4),
  ('b53db64e-4e8f-5949-9743-cb22dfb4b712', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '5', 'Piso: revestimento liso, impermeável e lavável.', false, 5),
  ('6388badd-57d2-5fb3-8162-07775efad2ee', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '5.1', 'Piso: em adequado estado de conservação (livre de defeitos, rachaduras, trincas, buracos).', false, 6),
  ('0ef9938a-9e5c-5688-b592-76f33303e55e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '5.2', 'Piso: sistema de drenagem dimensionado e sem acúmulo de água.', false, 7),
  ('9235fffc-d01b-5a7d-ad7d-666d0b89545b', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '5.3', 'Piso: ralos sifonados e grelhas com dispositivo de fechamento.', false, 8),
  ('ad445036-ffc2-562a-b0eb-b5c399ca60fd', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '6', 'Parede: revestimento liso, impermeável e lavável.', false, 9),
  ('fafbcf17-edcd-5620-95e5-1e5e7131ba54', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '6.1', 'Parede: em adequado estado de conservação (livre de falhas, rachaduras, umidade, bolor).', false, 10),
  ('143fa30b-8f34-51cc-b27e-998e7a6a6330', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '6.2', 'Parede: pintura em cores claras, lavável e sem desprendimento de tinta.', false, 11),
  ('d3e84246-2cfb-52fd-b763-d3387de23084', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '6.3', 'Parede: higienizada e em adequado estado de conservação.', false, 12),
  ('0a0454c0-afc7-541d-8509-135605aef186', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '7', 'Teto: revestimento liso, impermeável, lavável e em cor clara.', false, 13),
  ('46284a67-39a2-5fd1-b60a-d623ee17ff68', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '7.1', 'Teto: em adequado estado de conservação (livre de trincas, rachaduras, umidade, bolor).', false, 14),
  ('0a881b96-16fa-5e3f-9469-1fd4bdc2d3d8', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '7.2', 'Teto: higienizado.', false, 15),
  ('55f36552-880d-5e32-976d-37e0600bb458', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '7.3', 'Teto: ausência de objetos pendurados em desacordo com as Boas Práticas.', false, 16),
  ('29df1bd6-38d5-50be-8594-907d36171e37', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '8', 'Portas com superfície lisa, de fácil higienização, ajustadas aos batentes, sem falhas de revestimento.', false, 17),
  ('55ea25dc-2083-52da-9db7-9f16f5b485ea', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '8.1', 'Portas externas com fechamento automático (mola, sistema eletrônico ou outro).', false, 18),
  ('a27d50d5-a7e9-5a61-9d87-48d0935c2789', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '8.2', 'Portas externas com barreiras adequadas para impedir entrada de vetores e pragas urbanas.', false, 19),
  ('b0093709-f115-520b-aae8-148d35e4573d', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '9', 'Janelas com superfície lisa, de fácil higienização, ajustadas aos batentes.', false, 20),
  ('2bece9c3-9a99-54df-8a88-5c0c62aa7883', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '9.1', 'Janelas providas de telas milimétricas removíveis para limpeza.', false, 21),
  ('ca1d4f01-446a-5b30-8711-f0ecff8c463b', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '9.2', 'Janelas em adequado estado de conservação.', false, 22),
  ('210d9f54-6e1f-558a-b263-cd630cf77141', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '10', 'Iluminação adequada às atividades realizadas.', false, 23),
  ('37ba19bc-f698-51c0-b4c1-ecb2f9f34ebc', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '10.1', 'Luminárias com proteção contra explosão e quedas acidentais.', false, 24),
  ('215e851a-ab9d-55aa-8083-cb4e708499c1', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '10.2', 'Instalações elétricas embutidas ou externas revestidas por tubulações isolantes e firmemente fixadas.', false, 25),
  ('3a6eb281-f610-5bd3-a21a-8597aef423dd', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '10.3', 'Instalações elétricas em adequado estado de conservação.', false, 26),
  ('0d519167-9f02-5ac1-961c-3a539fb4df3b', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '11', 'Ventilação garantindo conforto térmico e ambiente livre de fungos, gases, fumaça e condensação.', false, 27),
  ('42f500b8-c52f-5818-b624-785c44024e0f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '11.1', 'Ar insuflado sem incidência direta sobre os alimentos.', false, 28),
  ('f3e37233-3144-5ed7-b52c-b9b5b486d619', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '11.2', 'Equipamentos e filtros higienizados periodicamente.', false, 29),
  ('fa8d5695-72be-571b-88e1-263203eba239', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '11.3', 'Sistema de exaustão dimensionado adequadamente.', false, 30),
  ('52e6264f-cf64-5be8-9964-b1184eb9d007', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '11.4', 'Registro periódico de manutenção dos equipamentos de climatização.', false, 31),
  ('4832e6ca-8b8d-53ae-a380-9eb1c5a0b319', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '12', 'Eliminação adequada de águas servidas, sem acúmulo e sem refluxo.', false, 32),
  ('e4fd3c6e-5972-5ab3-b135-060562c44a7a', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '13', 'Água de abastecimento proveniente de fonte adequada e dentro dos padrões de potabilidade.', true, 33),
  ('c72d9096-4ef0-5f60-89b1-40b884a55e86', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '13.1', 'Volume e pressão suficientes para atender todas as atividades.', false, 34),
  ('2ba3b769-b535-5eb3-bf56-93957e6cadfb', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '13.2', 'Caixa d''água em adequado estado de conservação, livre de rachaduras e vazamentos.', false, 35),
  ('b6c754f4-6d97-54fe-9d70-f6467447874f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '13.3', 'Caixa d''água higienizada periodicamente (mínimo a cada 6 meses), com registro.', false, 36),
  ('230ecac8-3998-5411-8c77-4d1712a5a799', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14', 'Instalações sanitárias sem comunicação direta com a área de produção e refeições.', false, 37),
  ('e3f4ff8b-549c-5ef6-b07b-69bbd232aa7e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14.1', 'Instalações sanitárias em adequado estado de conservação.', false, 38),
  ('0ab5a007-db64-5623-9406-8b24982776b8', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14.2', 'Instalações sanitárias higienizadas com frequência adequada.', false, 39),
  ('1db58dc7-e7a8-5612-9b23-7cf837b3a103', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14.3', 'Portas com fechamento automático.', false, 40),
  ('bf2c5281-f9d3-5c25-ad63-74b4f7581035', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14.4', 'Lavatórios com sabonete líquido inodoro, antisséptico e papel toalha não reciclado.', false, 41),
  ('85addf9a-cdae-5a9a-8a56-84c68bcbfff8', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14.5', 'Coletores de papel acionados sem contato manual.', false, 42),
  ('98a16bc2-63fe-504e-ace0-0ea64f27387e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '14.6', 'Vestiários separados por sexo, com armários individuais.', false, 43),
  ('39a126a2-f2de-5417-bf4c-0e39c6fa90b8', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '15', 'Lavatórios exclusivos para higienização das mãos na área de manipulação, em posição estratégica.', false, 44),
  ('aa431119-004e-51e3-85ac-5ca16729148f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '15.1', 'Lavatórios com sabonete líquido inodoro, antisséptico e papel toalha não reciclado.', false, 45),
  ('41964c3a-7edc-5b00-a8cd-0ca594284e87', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '15.2', 'Lavatórios com coletores de papel acionados sem contato manual.', false, 46),
  ('0d360dc8-5ded-5188-b669-e83bf265358d', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c6c3c1e1-29c0-51eb-bd2e-e48718b8790c', '15.3', 'Lavatórios com cartazes orientando a correta higienização das mãos.', false, 47),
  ('8791b6e4-cce5-50fe-9b18-ff6ecbcb421d', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb20fa55-598e-5bf8-9c84-e5eb5048e155', '16', 'Equipamentos da linha de produção com desenho e número que permitem operação, limpeza e manutenção adequadas.', false, 48),
  ('c4a5e95b-5e9b-5271-939c-012ff1bdadae', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb20fa55-598e-5bf8-9c84-e5eb5048e155', '17', 'Superfícies em contato com alimentos lisas, íntegras, impermeáveis, resistentes à corrosão, sem rugosidades.', false, 49),
  ('e6a30274-b970-54e2-af4f-5db3347805eb', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb20fa55-598e-5bf8-9c84-e5eb5048e155', '18', 'Em adequado estado de conservação e funcionamento.', false, 50),
  ('cb41efd8-e99c-5d04-b633-b1a712eca484', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb20fa55-598e-5bf8-9c84-e5eb5048e155', '19', 'Equipamentos de conservação dos alimentos (refrigeradores, freezers) com medidor de temperatura calibrado.', false, 51),
  ('7439be33-93e3-588a-8bb9-6aa5ed1de717', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb20fa55-598e-5bf8-9c84-e5eb5048e155', '20', 'Existência de planilha de registro de manutenção preventiva e calibração de equipamentos.', false, 52),
  ('25ef0cd0-8eeb-54a5-bb2a-5ecf03a149db', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'f81ad737-1c5d-5b2e-a761-7026ba1ec573', '21', 'Existência de registro periódico da higienização de instalações e equipamentos.', false, 53),
  ('f8627fee-9b5b-59f5-8888-d22faed46bcc', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'f81ad737-1c5d-5b2e-a761-7026ba1ec573', '21.1', 'Produtos de higienização regularizados pelo Ministério da Saúde.', false, 54),
  ('07bdc7ae-5bc9-59d7-84fd-6cb396a4d2c1', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'f81ad737-1c5d-5b2e-a761-7026ba1ec573', '21.2', 'Disponibilidade de produtos saneantes em quantidade suficiente.', false, 55),
  ('57484c84-b097-5032-a8a6-ec47ef80a4de', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'f81ad737-1c5d-5b2e-a761-7026ba1ec573', '21.3', 'Diluição, tempo de contato e modo de uso conforme instruções do fabricante.', false, 56),
  ('9501f7e8-1d0c-5806-b10f-06d4a86ba7e5', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'f81ad737-1c5d-5b2e-a761-7026ba1ec573', '21.4', 'Produtos armazenados em local reservado, identificados e separados dos alimentos.', false, 57),
  ('1024d7f1-6dd6-5240-b3eb-731e96d74e10', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'f81ad737-1c5d-5b2e-a761-7026ba1ec573', '21.5', 'Utensílios e equipamentos usados na higienização distintos dos usados na manipulação dos alimentos.', false, 58),
  ('a1d478d3-77b6-5317-b407-9c2b98ed135f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'eec23e71-61ec-5628-914d-a6eb0dbe924e', '22', 'Ausência de vetores e pragas urbanas ou qualquer evidência de sua presença.', true, 59),
  ('c7b3df18-8826-5e1f-bda7-3af57e7cde7e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'eec23e71-61ec-5628-914d-a6eb0dbe924e', '23', 'Adoção de medidas preventivas e corretivas para impedir a atração, abrigo e proliferação de vetores.', false, 60),
  ('8d5a3af8-625d-551a-b524-f9bf680d32e5', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'eec23e71-61ec-5628-914d-a6eb0dbe924e', '24', 'Quando aplicado controle químico, empresa especializada e registrada nos órgãos competentes.', false, 61),
  ('a5fa9f53-d5ee-58b3-a8a1-ebd61b5305a5', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'ed6b2527-6044-5ad9-a713-a51372ca93b7', '25', 'Utilização de água potável para manipulação de alimentos.', true, 62),
  ('f2159651-3926-5806-9d95-2e589c0a6f71', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'ed6b2527-6044-5ad9-a713-a51372ca93b7', '26', 'Quando utilizada solução alternativa, comprovada potabilidade semestral.', false, 63),
  ('127bf8ef-602d-5d5a-9523-328020e62d0d', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'ed6b2527-6044-5ad9-a713-a51372ca93b7', '27', 'Sistema de captação protegido (poços e cisternas).', false, 64),
  ('617645e0-4249-5642-ac79-1b05041b95d2', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'ed6b2527-6044-5ad9-a713-a51372ca93b7', '28', 'Reservatório acessível com instalação hidráulica em adequada conservação.', false, 65),
  ('53bd783d-21d7-59d0-8cc1-6150e1a49f4f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'ed6b2527-6044-5ad9-a713-a51372ca93b7', '29', 'Gelo produzido com água potável, mantido em condições higiênico-sanitárias.', false, 66),
  ('94549fb7-a355-587f-b203-d8010c6c1840', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'ed6b2527-6044-5ad9-a713-a51372ca93b7', '30', 'Vapor gerado a partir de água potável, livre de substâncias contaminantes.', false, 67),
  ('b388562f-f892-5de0-935c-341546fd2157', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '1c6b9b2b-23a4-5bf2-a003-7f637f81bfce', '31', 'Recipientes de coleta interna identificados e higienizados constantemente.', false, 68),
  ('3d8d512c-7f3f-5c54-9e77-2b1da9b4b4ba', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '1c6b9b2b-23a4-5bf2-a003-7f637f81bfce', '32', 'Uso de sacos de lixo apropriados; quando reutilizáveis, materiais que facilitem higienização.', false, 69),
  ('47828fdf-bbd3-590f-81bd-81ff29e620b3', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '1c6b9b2b-23a4-5bf2-a003-7f637f81bfce', '33', 'Coletores tampados, com acionamento não manual.', false, 70),
  ('bfd5827a-b2ba-5d5d-b839-24d8f658ccf0', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '1c6b9b2b-23a4-5bf2-a003-7f637f81bfce', '34', 'Resíduos armazenados em local fechado e isolado da área de manipulação.', false, 71),
  ('eda4babe-3961-5aa5-9988-17fbb09edb77', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '35', 'Controle de saúde dos manipuladores realizado e registrado.', false, 72),
  ('ab596898-32d7-5d4f-8d19-f92b2579ceed', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '36', 'Manipuladores afastados quando apresentam lesões e/ou sintomas que comprometam a qualidade.', true, 73),
  ('53dd92bc-d5bf-5086-98e3-8149131240bd', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '37', 'Asseio pessoal: boa apresentação, asseio corporal, mãos limpas, unhas curtas sem esmalte.', false, 74),
  ('8a4d32a3-6b8d-5ee0-9e38-1ba7827a343c', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '38', 'Lavagem cuidadosa das mãos antes da manipulação e após qualquer interrupção.', true, 75),
  ('9fdd47a0-8302-5a9a-b5ea-9f7e8cffa3f5', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '39', 'Cartazes de orientação sobre a correta lavagem das mãos em locais estratégicos.', false, 76),
  ('fab2b553-37ef-5a01-88b4-87b400f03f7d', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '40', 'Manipuladores não fumam, não falam desnecessariamente, não cantam, não assobiam, não espirram, não tossem sobre os alimentos.', false, 77),
  ('750dbc3f-2b49-5f25-aa33-0469305fc023', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '41', 'Uniformes de trabalho de cor clara, adequados, limpos e em bom estado de conservação.', false, 78),
  ('a7f48068-5533-52e8-81ad-9756311b592e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '42', 'Programa de capacitação adequado e contínuo, com registros.', false, 79),
  ('b39afd8a-0f53-5ae4-a9f7-a6a690136ba4', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b67f8ca-d1bf-528e-8052-895ca3a132ce', '43', 'Visitantes com uniforme apropriado.', false, 80),
  ('a172be25-4ead-52f7-b6af-f9959e5f8db6', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '44', 'Critérios estabelecidos para seleção e qualificação de fornecedores.', false, 81),
  ('0fc06a2c-a442-5246-835c-ba48e575d262', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '45', 'Recepção em área protegida e limpa.', false, 82),
  ('27614d36-6550-508b-9310-2bb7256cc520', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '46', 'Inspeção visual no recebimento, com avaliação do veículo e embalagens.', false, 83),
  ('72d59448-5372-546e-b3ba-88934ac36d99', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '47', 'Matérias-primas e ingredientes aguardando liberação identificados.', false, 84),
  ('43e30e15-39e2-56d5-aa69-20543c098e51', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '48', 'Matérias-primas, ingredientes e embalagens armazenados sobre paletes, estrados e/ou prateleiras.', false, 85),
  ('129231a1-9001-54ee-9a59-c532509eae2c', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '49', 'Embalagens primárias íntegras, sem contato direto com piso, paredes e teto.', false, 86),
  ('dc93b229-8e43-5c40-bd19-32c9c494686a', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '0b6b3b8b-5cee-5f72-b4fc-309d74562e31', '50', 'Validade respeitada para todos os insumos.', true, 87),
  ('12472d53-f1e6-5ec2-ac87-25d9f8e309ac', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '51', 'Adoção de medidas para evitar contaminação cruzada.', true, 88),
  ('6dfd0575-03ee-5892-ac6d-4a82d5cb8016', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '52', 'Manipuladores que atuam em diferentes atividades adotam medidas para evitar contaminação cruzada.', false, 89),
  ('297a625e-b9e6-5e47-8fb2-35fbaf1ea136', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '53', 'Matérias-primas e ingredientes higienizados antes do uso.', false, 90),
  ('69804cda-ab82-5b9c-b933-eb8da4ed64bf', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '54', 'Procedimentos específicos para higienização de hortifrutícolas, com produtos regularizados.', false, 91),
  ('27cafba3-e797-5dcd-9b64-af5f382eaa5f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '55', 'Descongelamento conduzido sob refrigeração (≤ 5°C) ou em forno de micro-ondas.', false, 92),
  ('ff0bee53-09cd-5db7-90fa-3fd5c7fe6ea8', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '56', 'Alimentos descongelados não recongelados antes ou após preparo.', false, 93),
  ('143f83db-5962-5dd9-a498-df29ade33aab', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '57', 'Alimentos preparados mantidos em condições de tempo e temperatura que evitem multiplicação microbiana.', true, 94),
  ('36aa0c16-80e3-5e6c-acc5-49c28d61b430', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '58', 'Tratamento térmico atinge no mínimo 70°C no centro geométrico do alimento.', true, 95),
  ('579ebc41-fb59-59f9-8882-381fd0779f6e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '59', 'Óleos e gorduras utilizados em frituras não aquecidos acima de 180°C, substituídos quando apresentarem alterações.', false, 96),
  ('e7ad7bbc-7a19-572d-8348-267c813142b8', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '60', 'Após cocção, alimentos expostos a quente mantidos acima de 60°C por no máximo 6 horas.', true, 97),
  ('0b6d0a0b-cbe6-5631-a062-a3c946c29527', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '61', 'Após cocção, alimentos resfriados de 60°C a 10°C em no máximo 2 horas.', false, 98),
  ('6b7af4fe-cb4f-5979-b095-979809cda4f6', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '62', 'Resfriamento conduzido em equipamento adequado.', false, 99),
  ('b0c1def2-eb82-5ebf-9a4b-1762aad35cf7', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '63', 'Alimentos resfriados conservados sob refrigeração (≤ 5°C) ou congelados.', true, 100),
  ('8f698cac-0db1-5c48-9126-9582fc39d600', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '64', 'Para conservação a quente, equipamentos mantendo temperatura ≥ 60°C.', false, 101),
  ('f55b96f3-2b56-5b87-a21e-a764facf69be', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '65', 'Para conservação sob refrigeração ou congelamento, temperatura conforme recomendação do fabricante.', false, 102),
  ('f1a0a583-a3d5-5519-a8ff-2e21d6b6cb39', 'b64f185c-73b4-5acf-a931-a2f8a4800114', '01533bea-6b1b-569c-8ced-c9424e3256a3', '66', 'Alimentos crus higienizados de forma a reduzir a contaminação superficial.', false, 103),
  ('c281ff03-1e24-525d-ad23-b1de03e86908', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c2cc4d2c-5084-50b6-97ce-b62b0be62615', '67', 'Alimentos preparados armazenados em recipientes cobertos, identificados, com data de preparo e validade.', false, 104),
  ('6690a64e-b684-5d89-96ea-0af1995548d3', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c2cc4d2c-5084-50b6-97ce-b62b0be62615', '68', 'Armazenamento sob temperatura adequada conforme o tipo de alimento.', false, 105),
  ('8df85958-fdea-5afa-8c27-542c45e9fad2', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'c2cc4d2c-5084-50b6-97ce-b62b0be62615', '69', 'Meios de transporte mantidos em condições higiênico-sanitárias adequadas.', false, 106),
  ('0c0d487f-b79b-5af3-9748-7a255c1c6cb5', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'e8f6908a-a932-5133-850e-5c3222c15701', '70', 'Área de exposição mantida organizada e em adequadas condições higiênico-sanitárias.', false, 107),
  ('fb418a4f-8b0e-57f4-b73e-1c6a42030d11', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'e8f6908a-a932-5133-850e-5c3222c15701', '71', 'Equipamentos e utensílios disponíveis em quantidade suficiente, mantendo temperaturas adequadas.', false, 108),
  ('377a1592-cd86-5a94-aa61-549e6b328b99', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'e8f6908a-a932-5133-850e-5c3222c15701', '72', 'Manipuladores realizam antissepsia das mãos.', false, 109),
  ('1f1eab4d-6dc6-52aa-9320-b81d2a056ec0', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'e8f6908a-a932-5133-850e-5c3222c15701', '73', 'Existência de barreiras de proteção (anteparos) na exposição.', false, 110),
  ('44735768-fbf3-59fd-ad93-fbcd82d7738f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'e8f6908a-a932-5133-850e-5c3222c15701', '74', 'Utensílios para consumo (pratos, talheres, copos) higienizados e armazenados em local protegido. Área de recebimento de dinheiro separada da manipulação.', false, 111),
  ('22ac879c-0969-5baf-b1be-892b15cc8619', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '75', 'Manual de Boas Práticas disponível para os funcionários e acessível à autoridade sanitária.', false, 112),
  ('dd5db2b3-c801-5b52-abae-5dc9a4ddaf0e', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '76', 'Procedimentos Operacionais Padronizados (POPs) elaborados, aprovados, datados e assinados.', false, 113),
  ('d3888a7a-0d5d-57a3-8b47-0368ba388af2', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '77', 'POP de higienização de instalações, equipamentos, móveis e utensílios implementado.', false, 114),
  ('f8bfc4ed-7ad9-5890-8b80-dd8870cc09e1', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '78', 'POP de controle integrado de vetores e pragas urbanas implementado.', false, 115),
  ('a54940b5-90c5-500f-9386-93989aa6762f', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '79', 'POP de higienização do reservatório de água implementado.', false, 116),
  ('fb5b60d4-dcbc-5b66-a9e2-69d4f1f3938a', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '80', 'POP de higiene e saúde dos manipuladores implementado.', false, 117),
  ('32b661c6-93cf-52ae-90b3-35312d6076f2', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '81', 'Registros mantidos por período mínimo de 30 dias.', false, 118),
  ('9bc2d9cb-4064-5be5-9225-9b7d5f113410', 'b64f185c-73b4-5acf-a931-a2f8a4800114', 'fb346679-9265-549a-b5fe-5a9807b6d26c', '82', 'Programa de capacitação de manipuladores documentado.', false, 119)
ON CONFLICT (modelo_versao_id, item_key) DO NOTHING;

-- Função de resolução do modelo padrão — hoje trivial (só existe RDC 275),
-- mas é o ponto de extensão deliberado: a Fase 9 substitui só o CORPO desta
-- função por uma regra de estado + tipo de estabelecimento, sem exigir
-- nenhuma mudança nos call sites (crm_obter_ou_criar_diagnostico,
-- createNewInspecao, backfill de inspecoes).
CREATE OR REPLACE FUNCTION public.resolver_checklist_modelo_padrao()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $function$
  SELECT id FROM public.checklist_modelo_versoes WHERE modelo_id = '5786ec19-3657-55b7-82c0-5c505d2190bf' AND is_versao_atual = true LIMIT 1;
$function$;

-- id fixo para uso no backfill de inspecoes (migration seguinte): b64f185c-73b4-5acf-a931-a2f8a4800114
