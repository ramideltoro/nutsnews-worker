import { describe, it, expect, vi, afterEach } from 'vitest';
import { __test } from '../src/index';
afterEach(() => vi.restoreAllMocks());
const item = (i: number) => `<item><title>Garden ${i}</title><link>https://example.test/${i}</link><description>Neighbors support a community garden.</description></item>`;
describe('bounded RSS candidate work', () => {
  it('retains the first 35 RSS items and prefers RSS over Atom in mixed feeds', () => {
    const rss = Array.from({length: 1000}, (_, i) => item(i)).join('');
    const result = __test.parseRss(`<feed><entry><title>Atom</title><link href="https://example.test/atom"/></entry>${rss}</feed>`, 'Fixture');
    expect(result).toHaveLength(35);
    expect(result.map(a => a.title)).toEqual(Array.from({length:35}, (_, i) => `Garden ${i}`));
  });
  it('still supports Atom and empty documents', () => {
    expect(__test.parseRss('<feed><entry><title>Community</title><link href="https://example.test/atom"/><summary>A garden</summary></entry></feed>', 'Fixture')[0]).toMatchObject({title:'Community',url:'https://example.test/atom'});
    expect(__test.parseRss('<rss/>', 'Fixture')).toEqual([]);
  });
  it('preserves ranking, date tie breaks, stable ties and the original input', () => {
    const now = Date.parse('2026-09-20T12:00:00Z');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const sources = new Set(['Positive']);
    const articles = Array.from({length:700}, (_, i) => ({source:i%3?'Fixture':'Positive', title:i%2?'Garden community support':'War crime', excerpt:'Neighborhood '.repeat(i%20), url:`https://example.test/${i}`, imageUrl:i%4?null:'https://example.test/photo.jpg', publishedAt:i%7?new Date(now-(i%180)*3600000).toISOString():null}));
    const original = [...articles];
    const expected = [...articles].sort((a,b) => __test.scoreArticleCandidate(b,sources,now)-__test.scoreArticleCandidate(a,sources,now) || (b.publishedAt?Date.parse(b.publishedAt):0)-(a.publishedAt?Date.parse(a.publishedAt):0));
    clock.mockClear();
    expect(__test.sortArticlesForReview(articles,sources)).toEqual(expected);
    expect(clock).toHaveBeenCalledTimes(1);
    expect(articles).toEqual(original);
  });
});
