import type { AddonOption, CategoryId, Product, StoreConfig } from '../types/order';

/**
 * ============================================================================
 * WHATSAPP DA LOJA — ÚNICO LUGAR PARA TROCAR O NÚMERO
 * Escreva SOMENTE os números: código do país (55) + DDD + número.
 * Sem espaços, sem traços, sem parênteses e sem "+".
 * Exemplo: '5534991029433'
 * ============================================================================
 */
export const WHATSAPP_LOJA = '5534991029433';

/**
 * ============================================================================
 * CHAVE PIX DA LOJA — ÚNICO LUGAR PARA TROCAR O PIX
 * Troque pela chave do cliente real (CPF/CNPJ só números, telefone +55...,
 * e-mail ou chave aleatória), nome do recebedor (até 25 letras) e cidade.
 * ============================================================================
 */
export const PIX_LOJA = {
  chave: '03039213237',
  nomeRecebedor: 'BURGER PRIME',
  cidadeRecebedor: 'UBERLANDIA',
};

/**
 * ============================================================================
 * CONFIGURAÇÃO PRINCIPAL DA LOJA (EDITE AQUI)
 * Altere nome, slogan, cor principal, horários, pedido mínimo e
 * taxas de entrega por bairro em um único lugar.
 * ============================================================================
 */
export const STORE_CONFIG: StoreConfig = {
  nome: 'Burger Prime',
  slogan: 'Smash artesanal na brasa, pão brioche amanteigado e molhos da casa.',
  corPrincipal: '#D9381E', // Vermelho/laranja artesanal (aceita qualquer cor HEX)
  whatsapp: WHATSAPP_LOJA,
  pix: PIX_LOJA,
  mensagemContatoWhatsApp: 'Olá! Vim pelo cardápio digital da Burger Prime e gostaria de tirar uma dúvida.',
  logoUrl: '', // Opcional: informe o caminho/URL de uma imagem para substituir o emblema padrão
  heroBannerUrl: '/src/assets/images/hero_burger_prime_1795091175441.jpg',
  enderecoRetirada: 'Av. João Naves de Ávila, 1420 — Santa Mônica',
  cidadeUf: 'Uberlândia, MG',
  tempoEstimadoEntrega: '35–50 min',
  tempoEstimadoRetirada: '15–25 min',
  pedidoMinimo: 25.0,
  resumoHorario: 'Seg a Qui 18h às 23h30 · Sex a Dom 18h às 00h30',
  // 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
  horarioFuncionamento: {
    0: { aberto: true, abre: '18:00', fecha: '00:30' },
    1: { aberto: true, abre: '18:00', fecha: '23:30' },
    2: { aberto: true, abre: '18:00', fecha: '23:30' },
    3: { aberto: true, abre: '18:00', fecha: '23:30' },
    4: { aberto: true, abre: '18:00', fecha: '23:30' },
    5: { aberto: true, abre: '18:00', fecha: '00:30' },
    6: { aberto: true, abre: '18:00', fecha: '00:30' },
  },
  // Lista editável de bairros atendidos em Uberlândia/MG e suas taxas
  bairrosEntrega: [
    { id: 'santa-monica', nome: 'Santa Mônica', taxa: 5.0 },
    { id: 'centro', nome: 'Centro', taxa: 6.0 },
    { id: 'fundinho', nome: 'Fundinho', taxa: 6.0 },
    { id: 'tibery', nome: 'Tibery', taxa: 6.0 },
    { id: 'saraiva', nome: 'Saraiva', taxa: 6.5 },
    { id: 'martins', nome: 'Martins', taxa: 7.0 },
    { id: 'brasil', nome: 'Brasil', taxa: 7.0 },
    { id: 'morada-da-colina', nome: 'Morada da Colina', taxa: 8.0 },
    { id: 'umuarama', nome: 'Umuarama', taxa: 8.0 },
    { id: 'tubalina', nome: 'Tubalina', taxa: 8.5 },
    { id: 'karaiba', nome: 'Karaíba', taxa: 9.0 },
    { id: 'planalto', nome: 'Planalto', taxa: 9.5 },
    { id: 'luizote', nome: 'Luizote de Freitas', taxa: 10.0 },
    { id: 'granja-marileusa', nome: 'Granja Marileusa', taxa: 12.0 },
    { id: 'outro-bairro', nome: 'Outro bairro', taxa: null, aCombinar: true },
  ],
};

/**
 * Opções de ponto da carne exibidas para hambúrgueres e combos com carne bovina.
 */
export const PONTOS_CARNE: string[] = [
  'Mal passado',
  'Ao ponto',
  'Bem passado',
];

/**
 * Lista global de adicionais com preço (edite valores e itens aqui).
 */
export const ADICIONAIS_PADRAO: AddonOption[] = [
  { id: 'bacon-crocante', nome: 'Bacon crocante', preco: 5.5 },
  { id: 'queijo-cheddar', nome: 'Queijo cheddar extra', preco: 4.5 },
  { id: 'ovo-chapa', nome: 'Ovo caipira na chapa', preco: 3.5 },
  { id: 'blend-extra', nome: 'Hambúrguer extra 150g', preco: 11.0 },
  { id: 'cebola-caramelizada', nome: 'Cebola caramelizada', preco: 3.5 },
  { id: 'molho-prime', nome: 'Maionese Prime extra (pote)', preco: 3.0 },
];

/**
 * Categorias exibidas na barra fixa de navegação e nas seções do cardápio.
 */
export const CATEGORIAS: { id: CategoryId; nome: string }[] = [
  { id: 'destaques', nome: 'Destaques' },
  { id: 'hamburgueres', nome: 'Hambúrgueres' },
  { id: 'combos', nome: 'Combos' },
  { id: 'porcoes', nome: 'Porções' },
  { id: 'bebidas', nome: 'Bebidas' },
  { id: 'sobremesas', nome: 'Sobremesas' },
];

/**
 * ============================================================================
 * LISTA DE PRODUTOS DO CARDÁPIO (EDITE NOMES, PREÇOS E FOTOS AQUI)
 * ============================================================================
 */
export const PRODUTOS: Product[] = [
  // ---------------- HAMBÚRGUERES ----------------
  {
    id: 'prime-classic-smash',
    nome: 'Prime Classic Smash',
    descricao:
      'Blend bovino 150g prensado na chapa com crosta caramelizada, queijo cheddar inglês, alface americana, tomate italiano, picles artesanal e maionese Prime no brioche selado.',
    preco: 29.9,
    categoria: 'hamburgueres',
    imagem: '/src/assets/images/burger_classic_smash_1795091232144.jpg',
    etiqueta: 'Mais pedido',
    destaque: true,
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Alface', 'Tomate', 'Picles', 'Cebola roxa', 'Maionese Prime'],
  },
  {
    id: 'cheddar-bacon-defumado',
    nome: 'Cheddar Bacon Defumado',
    descricao:
      'Blend bovino 170g na brasa, dupla camada de cheddar cremoso derretido, tiras grossas de bacon defumado crocante, cebola caramelizada no shoyu e barbecue da casa.',
    preco: 36.9,
    categoria: 'hamburgueres',
    imagem: '/src/assets/images/burger_cheddar_bacon_1795091175542.jpg',
    etiqueta: 'Mais pedido',
    destaque: true,
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Cebola caramelizada', 'Barbecue', 'Alface', 'Tomate'],
  },
  {
    id: 'duplo-brasa-prime',
    nome: 'Duplo Brasa Prime',
    descricao:
      'Dois blends bovinos de 150g grelhados no fogo forte, queijo prato e cheddar derretidos, cebola crispy bem sequinha, rúcula fresca e maionese de pimenta-do-reino.',
    preco: 43.9,
    categoria: 'hamburgueres',
    imagem: '/src/assets/images/burger_duplo_brasa_1795091175333.jpg',
    destaque: true,
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Cebola crispy', 'Rúcula', 'Maionese de pimenta'],
  },
  {
    id: 'trufado-da-casa',
    nome: 'Trufado da Casa',
    descricao:
      'Blend 180g suculento, creme de gorgonzola suave, cogumelos Paris salteados na manteiga de ervas, folhas de rúcula e aioli trufado no pão brioche com flor de sal.',
    preco: 45.9,
    categoria: 'hamburgueres',
    imagem: '/src/assets/images/burger_trufado_gourmet_1795091174416.jpg',
    etiqueta: 'Novo',
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Cogumelos', 'Rúcula', 'Gorgonzola', 'Aioli trufado'],
  },
  {
    id: 'chicken-crispy-mel',
    nome: 'Chicken Crispy Mel & Mostarda',
    descricao:
      'Sobrecoxa de frango empanada crocante estilo buttermilk, picles de pepino agridoce, alface americana picadinha e molho artesanal de mel com mostarda Dijon.',
    preco: 31.9,
    categoria: 'hamburgueres',
    imagem: '/src/assets/images/burger_chicken_crispy_1795091176332.jpg',
    permitePontoCarne: false,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Picles', 'Alface', 'Molho mel & mostarda'],
  },
  {
    id: 'veggie-grao-cogumelos',
    nome: 'Veggie Grão & Cogumelos',
    descricao:
      'Disco artesanal de grão-de-bico com cogumelos tostados, queijo provolone derretido, fatias de abacate, pimentão assado, rúcula e aioli de ervas no brioche com sementes.',
    preco: 33.9,
    categoria: 'hamburgueres',
    imagem: '/src/assets/images/burger_veggie_artisan_1795091175048.jpg',
    etiqueta: 'Novo',
    permitePontoCarne: false,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Abacate', 'Pimentão assado', 'Rúcula', 'Aioli de ervas'],
  },

  // ---------------- COMBOS ----------------
  {
    id: 'combo-prime-classic',
    nome: 'Combo Prime Classic',
    descricao:
      '1 Prime Classic Smash + 1 porção individual de batata rústica temperada com alecrim + 1 maionese da casa + 1 refrigerante lata 350ml.',
    preco: 44.9,
    categoria: 'combos',
    imagem: '/src/assets/images/combo_burger_fries_1795091175480.jpg',
    etiqueta: 'Mais pedido',
    destaque: true,
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Alface', 'Tomate', 'Picles', 'Cebola roxa', 'Alecrim na batata'],
  },
  {
    id: 'combo-cheddar-bacon',
    nome: 'Combo Cheddar Bacon',
    descricao:
      '1 Cheddar Bacon Defumado + 1 batata rústica individual + 1 molho barbecue artesanal + 1 refrigerante lata 350ml bem gelado.',
    preco: 51.9,
    categoria: 'combos',
    imagem: '/src/assets/images/burger_cheddar_bacon_1795091175542.jpg',
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Cebola caramelizada', 'Barbecue', 'Alface', 'Tomate'],
  },
  {
    id: 'combo-casal-prime',
    nome: 'Combo Casal Prime',
    descricao:
      '2 burgers à sua escolha (Prime Classic ou Cheddar Bacon — informe na observação) + 1 Batata Suprema para dividir + 2 refrigerantes lata 350ml.',
    preco: 89.9,
    categoria: 'combos',
    imagem: '/src/assets/images/combo_burger_fries_1795091175480.jpg',
    etiqueta: 'Novo',
    permitePontoCarne: true,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Cebola', 'Picles', 'Tomate', 'Cebolinha na batata'],
  },

  // ---------------- PORÇÕES ----------------
  {
    id: 'batata-rustica-alecrim',
    nome: 'Batata Rústica com Alecrim',
    descricao:
      '350g de batatas cortadas com casca, fritas até ficarem douradas e crocantes, finalizadas com sal marinho, páprica defumada e alecrim fresco. Acompanha maionese Prime.',
    preco: 21.9,
    categoria: 'porcoes',
    imagem: '/src/assets/images/combo_burger_fries_1795091175480.jpg',
    permitePontoCarne: false,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Alecrim', 'Páprica defumada', 'Maionese Prime'],
  },
  {
    id: 'batata-suprema-cheddar-bacon',
    nome: 'Batata Suprema Cheddar & Bacon',
    descricao:
      '400g de batata rústica crocante coberta com creme quente de cheddar maturado, farofa generosa de bacon defumado e cebolinha verde picada.',
    preco: 29.9,
    categoria: 'porcoes',
    imagem: '/src/assets/images/sides_loaded_fries_1795091175128.jpg',
    etiqueta: 'Mais pedido',
    permitePontoCarne: false,
    permiteAdicionais: true,
    ingredientesRemoviveis: ['Cebolinha verde', 'Bacon'],
  },
  {
    id: 'aneis-cebola-empanados',
    nome: 'Anéis de Cebola Empanados',
    descricao:
      '10 unidades de anéis de cebola grossos empanados na farinha panko super crocante. Acompanha molho barbecue defumado da casa.',
    preco: 24.9,
    categoria: 'porcoes',
    imagem: '/src/assets/images/sides_onion_rings_1795091174630.jpg',
    permitePontoCarne: false,
    permiteAdicionais: false,
    ingredientesRemoviveis: ['Molho barbecue'],
  },

  // ---------------- BEBIDAS ----------------
  {
    id: 'milkshake-ovomaltine',
    nome: 'Milkshake de Ovomaltine 400ml',
    descricao:
      'Sorvete artesanal de creme batido com bastante Ovomaltine crocante, borda de chocolate meio amargo, chantilly fresco e calda quente de cacau.',
    preco: 21.9,
    categoria: 'bebidas',
    imagem: '/src/assets/images/drink_milkshake_ovo_1795091174744.jpg',
    etiqueta: 'Mais pedido',
    permitePontoCarne: false,
    permiteAdicionais: false,
    ingredientesRemoviveis: ['Chantilly', 'Calda de chocolate'],
  },
  {
    id: 'limonada-suica-casa',
    nome: 'Limonada Suíça da Casa 400ml',
    descricao:
      'Preparada na hora com limão Taiti selecionado, toque cremoso de leite condensado, hortelã fresca e gelo triturado.',
    preco: 12.9,
    categoria: 'bebidas',
    imagem: '/src/assets/images/drink_limonada_gelada_1795091175613.jpg',
    etiqueta: 'Novo',
    permitePontoCarne: false,
    permiteAdicionais: false,
    ingredientesRemoviveis: ['Hortelã', 'Gelo', 'Açúcar / leite condensado'],
  },
  {
    id: 'coca-cola-lata',
    nome: 'Coca-Cola Lata 350ml',
    descricao:
      'Servida trincando de gelada. Informe na observação se prefere Coca-Cola Original ou Coca-Cola Sem Açúcar.',
    preco: 6.9,
    categoria: 'bebidas',
    imagem: '/src/assets/images/combo_burger_fries_1795091175480.jpg',
    permitePontoCarne: false,
    permiteAdicionais: false,
    ingredientesRemoviveis: [],
  },

  // ---------------- SOBREMESAS ----------------
  {
    id: 'brownie-quente-sorvete',
    nome: 'Brownie Quente com Sorvete',
    descricao:
      'Brownie de chocolate meio amargo 54% assado com casquinha crocante e miolo úmido, bola de sorvete de creme, ganache quente e avelãs tostadas.',
    preco: 22.9,
    categoria: 'sobremesas',
    imagem: '/src/assets/images/dessert_brownie_sorvete_1795091175937.jpg',
    etiqueta: 'Mais pedido',
    permitePontoCarne: false,
    permiteAdicionais: false,
    ingredientesRemoviveis: ['Avelãs tostadas', 'Ganache de chocolate'],
  },
  {
    id: 'pudim-leite-artesanal',
    nome: 'Pudim de Leite Condensado',
    descricao:
      'Receita tradicional super cremosa, sem furinhos, cozido lentamente em banho-maria com calda brilhante de caramelo âmbar.',
    preco: 15.9,
    categoria: 'sobremesas',
    imagem: '/src/assets/images/dessert_pudim_leite_1795091175228.jpg',
    permitePontoCarne: false,
    permiteAdicionais: false,
    ingredientesRemoviveis: [],
  },
];
