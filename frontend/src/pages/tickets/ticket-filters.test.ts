import { describe, expect, it } from 'vitest';
import { countActiveFilters, PAGE_SIZE, readFilters } from './ticket-filters';

const read = (query: string) => readFilters(new URLSearchParams(query));

describe('readFilters', () => {
  it('sem parâmetros, usa a ordenação e a página padrão', () => {
    expect(read('')).toEqual({
      q: undefined,
      status: undefined,
      priority: undefined,
      categoryId: undefined,
      assignee: undefined,
      overdue: undefined,
      sort: 'newest',
      page: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it('aceita os valores válidos', () => {
    expect(
      read('q=notebook&status=OPEN&priority=URGENT&categoryId=cat-1&assignee=me&overdue=true&sort=due&page=3'),
    ).toMatchObject({
      q: 'notebook',
      status: 'OPEN',
      priority: 'URGENT',
      categoryId: 'cat-1',
      assignee: 'me',
      overdue: true,
      sort: 'due',
      page: 3,
    });
  });

  it('ignora status, prioridade e ordenação fora da lista', () => {
    const filters = read('status=DELETED&priority=urgent&sort=random');

    expect(filters.status).toBeUndefined();
    expect(filters.priority).toBeUndefined(); // os códigos diferenciam maiúsculas
    expect(filters.sort).toBe('newest');
  });

  it.each(['0', '-2', '1.5', 'abc', ''])('página inválida (%j) vira 1', (page) => {
    expect(read(`page=${page}`).page).toBe(1);
  });

  it('só considera "atrasados" com overdue=true', () => {
    expect(read('overdue=true').overdue).toBe(true);
    expect(read('overdue=1').overdue).toBeUndefined();
    expect(read('overdue=false').overdue).toBeUndefined();
  });

  it('trata parâmetros vazios como ausentes', () => {
    expect(read('q=&categoryId=&assignee=')).toMatchObject({
      q: undefined,
      categoryId: undefined,
      assignee: undefined,
    });
  });

  it('o tamanho da página não vem da URL', () => {
    expect(read('pageSize=500').pageSize).toBe(PAGE_SIZE);
  });
});

describe('countActiveFilters', () => {
  it('não conta a ordenação nem a página', () => {
    expect(countActiveFilters(read('sort=oldest&page=4'))).toBe(0);
  });

  it('conta cada filtro preenchido', () => {
    expect(countActiveFilters(read('q=wifi&status=OPEN&overdue=true&assignee=none'))).toBe(4);
  });

  it('valores inválidos não contam como filtro', () => {
    expect(countActiveFilters(read('status=DELETED&overdue=yes'))).toBe(0);
  });
});
