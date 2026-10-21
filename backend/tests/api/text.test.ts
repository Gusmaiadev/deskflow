import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { authHeader } from '../helpers/auth.js';
import { disconnectDatabase, resetDatabase, seedTestData, type TestData } from '../helpers/database.js';

const NUL = '\u0000';

let data: TestData;

beforeEach(async () => {
  await resetDatabase();
  data = await seedTestData();
});

afterAll(disconnectDatabase);

/** Abre um chamado da Ana com o título informado. */
async function openTicket(title: string) {
  const response = await request(app)
    .post('/api/tickets')
    .set(await authHeader('ana@test.example'))
    .send({ title, description: 'Descrição com detalhes suficientes.', categoryId: data.category.id });

  expect(response.status).toBe(201);
  return response.body.data;
}

/** A recusa esperada: 400 de validação apontando o campo, e não um 500 vindo do banco. */
function expectNullCharacterRejected(response: Response, field: string) {
  expect(response.status).toBe(400);
  expect(response.body.error.details).toEqual([{ field, message: 'O texto contém um caractere inválido.' }]);
}

describe('caractere nulo (U+0000)', () => {
  it('é recusado no título e na descrição do chamado', async () => {
    const ana = await authHeader('ana@test.example');
    const ticket = { title: 'Teclado não funciona', description: 'Nenhuma tecla responde.', categoryId: data.category.id };

    const inTitle = await request(app).post('/api/tickets').set(ana).send({ ...ticket, title: `Teclado${NUL} quebrado` });
    const inDescription = await request(app)
      .post('/api/tickets')
      .set(ana)
      .send({ ...ticket, description: `Nenhuma tecla${NUL} responde.` });

    expectNullCharacterRejected(inTitle, 'title');
    expectNullCharacterRejected(inDescription, 'description');
  });

  it('é recusado no comentário e na busca de chamados', async () => {
    const ana = await authHeader('ana@test.example');
    const ticket = await openTicket('Teclado não funciona');

    const comment = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(ana)
      .send({ body: `Continua${NUL} sem funcionar.` });
    const search = await request(app).get('/api/tickets').query({ q: `teclado${NUL}` }).set(ana);

    expectNullCharacterRejected(comment, 'body');
    expectNullCharacterRejected(search, 'q');
  });

  it('é recusado no nome e na descrição da categoria e no nome do usuário', async () => {
    const admin = await authHeader('admin@test.example');

    const categoryName = await request(app).post('/api/categories').set(admin).send({ name: `Rede${NUL}` });
    const categoryDescription = await request(app)
      .post('/api/categories')
      .set(admin)
      .send({ name: 'Rede', description: `Cabos${NUL} e Wi-Fi` });
    const userName = await request(app)
      .post('/api/users')
      .set(admin)
      .send({ name: `Carla${NUL}`, email: 'carla@test.example', password: 'senha-da-carla-123' });

    expectNullCharacterRejected(categoryName, 'name');
    expectNullCharacterRejected(categoryDescription, 'description');
    expectNullCharacterRejected(userName, 'name');
  });
});

describe('%, _ e \\ valem como texto comum', () => {
  it('no nome da categoria, só conflita o mesmo nome (ignorando maiúsculas)', async () => {
    const admin = await authHeader('admin@test.example');
    const create = (name: string) => request(app).post('/api/categories').set(admin).send({ name });

    // Já existe "Hardware".
    const underscore = await create('Hardwar_');
    const backslash = await create('Hardwar\\');
    const sameUnderscore = await create('HARDWAR_');
    const sameHardware = await create('HARDWARE');

    expect(underscore.status).toBe(201);
    expect(backslash.status).toBe(201);
    expect(sameUnderscore.status).toBe(409);
    expect(sameUnderscore.body.error.code).toBe('CATEGORY_NAME_IN_USE');
    expect(sameHardware.status).toBe(409);
    expect(sameHardware.body.error.code).toBe('CATEGORY_NAME_IN_USE');
  });

  it('a busca de chamados procura o texto digitado, e não um padrão', async () => {
    const ana = await authHeader('ana@test.example');
    for (const title of ['Meta de 100% atingida', 'Campo user_id vazio', 'Pasta C:\\dados sumiu', 'Impressora sem toner']) {
      await openTicket(title);
    }

    const search = async (q: string) => {
      const response = await request(app).get('/api/tickets').query({ q }).set(ana);
      return response.body.data.map((ticket: { title: string }) => ticket.title);
    };

    expect(await search('%')).toEqual(['Meta de 100% atingida']);
    expect(await search('_')).toEqual(['Campo user_id vazio']);
    expect(await search('C:\\dados')).toEqual(['Pasta C:\\dados sumiu']);
    expect(await search('c:\\DADOS')).toEqual(['Pasta C:\\dados sumiu']); // continua sem diferenciar maiúsculas
  });
});
