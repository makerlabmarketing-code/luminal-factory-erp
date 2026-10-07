import { describe,it,expect } from 'vitest';
import { Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CommonTable, TableRowActions, collectRowActions } from '../component/data-table/CommonTable';
describe('Shared tables and screen-owned actions',()=>{
 it('keeps semantic table, columns, sorting controls and row markup',()=>{
  const html=renderToStaticMarkup(<CommonTable aria-label="Products"><thead><tr><th scope="col"><button>Name</button></th></tr></thead><tbody><tr><td>Meowhe</td></tr></tbody></CommonTable>);
  expect(html).toContain('<table');expect(html).toContain('erp-common-table');expect(html).toContain('scope="col"');expect(html).toContain('<button>Name</button>');expect(html).toContain('<td>Meowhe</td>');
 });
 it('counts rendered fragments and layout wrappers, not absent permission actions',()=>{
  expect(collectRowActions(<Fragment><div><button>Edit</button>{false && <button>Delete</button>}<a href="/history">History</a></div></Fragment>)).toHaveLength(2);
 });
 it('keeps two actions inline and preserves disabled HTML',()=>{
  const html=renderToStaticMarkup(<TableRowActions renderActions={()=>[<button key="edit" disabled>Edit</button>,<a key="history" href="/history">History</a>]} />);
  expect(html).toContain('disabled');expect(html).toContain('/history');expect(html).not.toContain('Thao tác khác');
 });
 it('keeps the primary action visible and collapses three actions behind a labelled trigger',()=>{
  const html=renderToStaticMarkup(<TableRowActions renderActions={()=><><button>Edit</button><button>Archive</button><button>Delete</button></>} />);
  expect(html).toContain('Edit');expect(html).not.toContain('Archive');expect(html).not.toContain('Delete');expect(html).toContain('Thao tác khác');expect(html).toContain('aria-expanded="false"');
 });
});
