process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");
const request = require("supertest");
const app = require("../app");
const db = require("../db");

const book = {
  isbn: "1234567890",
  amazon_url: "http://a.co/example",
  author: "Jane Author",
  language: "english",
  pages: 100,
  publisher: "Test Press",
  title: "A Test Book",
  year: 2024
};

beforeEach(async () => {
  await db.query("DELETE FROM books");
  await db.query(
    `INSERT INTO books (isbn, amazon_url, author, language, pages, publisher, title, year)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    Object.values(book)
  );
});

after(async () => {
  await db.end();
});

test("GET /books returns all books", async () => {
  const response = await request(app).get("/books");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { books: [book] });
});

test("GET /books/:isbn returns one book and 404s when absent", async () => {
  const response = await request(app).get(`/books/${book.isbn}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { book });

  const missing = await request(app).get("/books/missing");
  assert.equal(missing.status, 404);
});

test("POST /books creates a valid book", async () => {
  const newBook = { ...book, isbn: "0987654321", title: "Another Book" };
  const response = await request(app).post("/books").send(newBook);
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { book: newBook });
});

test("POST /books returns every schema problem", async () => {
  const response = await request(app).post("/books").send({ isbn: 42, pages: -1 });
  assert.equal(response.status, 400);
  assert.match(response.body.message, /isbn/);
  assert.match(response.body.message, /pages/);
  assert.match(response.body.message, /author/);
});

test("PUT /books/:isbn updates a valid book", async () => {
  const changes = { ...book, title: "Revised Title", pages: 150 };
  delete changes.isbn;
  const response = await request(app).put(`/books/${book.isbn}`).send(changes);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { book: { ...book, ...changes } });
});

test("PUT /books/:isbn validates input and 404s when absent", async () => {
  const invalid = await request(app).put(`/books/${book.isbn}`).send({ ...book, pages: "many" });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /pages/);

  const validUpdate = { ...book };
  delete validUpdate.isbn;
  const missing = await request(app).put("/books/missing").send(validUpdate);
  assert.equal(missing.status, 404);
});

test("DELETE /books/:isbn deletes a book and 404s when absent", async () => {
  const response = await request(app).delete(`/books/${book.isbn}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { message: "Book deleted" });

  const missing = await request(app).delete(`/books/${book.isbn}`);
  assert.equal(missing.status, 404);
});

test("unknown routes return 404", async () => {
  const response = await request(app).get("/no-such-route");
  assert.equal(response.status, 404);
});
