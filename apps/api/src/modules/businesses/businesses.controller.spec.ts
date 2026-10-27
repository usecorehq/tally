import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { INestApplication, NotFoundException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { SupabaseJwtGuard } from "../../common/guards/supabase-jwt.guard";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";

// HTTP layer only: real guard + validation, service mocked. DB behaviour is verified on staging.
const SECRET = "test-jwt-secret-not-real";
const USER = "00000000-0000-4000-8000-0000000000aa";
const BIZ = "00000000-0000-4000-8000-000000000001";
const token = jwt.sign({ sub: USER, role: "authenticated", aud: "authenticated" }, SECRET, { algorithm: "HS256", expiresIn: 60 });
const auth = { Authorization: `Bearer ${token}` };
const starterItem = { clientRef: "c1", templateItemName: "Rice (Bag)", outcome: "accepted", suggestedQid: "QC-7K2M-9XQ4-R", name: "Rice", price: "45000" };

describe("BusinessesController (HTTP)", () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(async () => ({ id: BIZ })),
    listForUser: jest.fn(async () => []),
    getForMember: jest.fn(async () => ({ id: BIZ, role: "owner" })),
    listInventory: jest.fn(async () => []),
    addStarterInventory: jest.fn(async () => ({ created: 1 })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BusinessesController],
      providers: [
        { provide: BusinessesService, useValue: service },
        { provide: ConfigService, useValue: { get: (k: string) => (k === "supabase.jwtSecret" ? SECRET : undefined) } },
        { provide: APP_GUARD, useClass: SupabaseJwtGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => Object.values(service).forEach((fn) => fn.mockClear()));

  const http = () => request(app.getHttpServer());

  it.each([
    ["post", "/api/businesses"],
    ["get", "/api/businesses"],
    ["get", `/api/businesses/${BIZ}`],
    ["get", `/api/businesses/${BIZ}/inventory`],
    ["post", `/api/businesses/${BIZ}/inventory/starter`],
  ] as const)("%s %s needs a Supabase JWT", async (method, path) => {
    await http()[method](path).expect(401);
  });

  it("create passes the caller as owner and trims the name", async () => {
    await http().post("/api/businesses").set(auth).send({ name: "  Mama Nkechi  ", subtypeCode: "supermarket" }).expect(201);
    expect(service.create).toHaveBeenCalledWith(USER, "Mama Nkechi", "supermarket");
  });

  it.each([
    [{ name: "", subtypeCode: "supermarket" }],
    [{ name: "x".repeat(121), subtypeCode: "supermarket" }],
    [{ name: "Shop", subtypeCode: "Super Market" }],
    [{ name: "Shop" }],
  ])("create rejects %j", async (body) => {
    await http().post("/api/businesses").set(auth).send(body).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("list / get / inventory pass the caller and business id", async () => {
    await http().get("/api/businesses").set(auth).expect(200);
    await http().get(`/api/businesses/${BIZ}`).set(auth).expect(200);
    await http().get(`/api/businesses/${BIZ}/inventory`).set(auth).expect(200);
    expect(service.listForUser).toHaveBeenCalledWith(USER);
    expect(service.getForMember).toHaveBeenCalledWith(BIZ, USER);
    expect(service.listInventory).toHaveBeenCalledWith(BIZ, USER);
  });

  it("a non-uuid business id is a 400 before the service runs", async () => {
    await http().get("/api/businesses/not-a-uuid").set(auth).expect(400);
    expect(service.getForMember).not.toHaveBeenCalled();
  });

  it("service errors pass through (e.g. 404)", async () => {
    service.getForMember.mockImplementationOnce(async () => {
      throw new NotFoundException(`No business ${BIZ}`);
    });
    await http().get(`/api/businesses/${BIZ}`).set(auth).expect(404);
  });

  it("starter returns 200 and passes the items", async () => {
    await http().post(`/api/businesses/${BIZ}/inventory/starter`).set(auth).send({ items: [starterItem] }).expect(200);
    expect(service.addStarterInventory).toHaveBeenCalledWith(BIZ, USER, [expect.objectContaining({ clientRef: "c1", price: "45000" })]);
  });

  it.each([
    ["no items", { items: [] }],
    ["201 items", { items: Array.from({ length: 201 }, (_, i) => ({ ...starterItem, clientRef: `c${i}` })) }],
    ["bad outcome", { items: [{ ...starterItem, outcome: "maybe" }] }],
    ["bad qid", { items: [{ ...starterItem, suggestedQid: "QC-BAD" }] }],
    ["float price", { items: [{ ...starterItem, price: "45000.555" }] }],
    ["negative opening stock", { items: [{ ...starterItem, openingQuantity: -1 }] }],
    ["score above 1", { items: [{ ...starterItem, suggestedScore: 1.5 }] }],
  ])("starter rejects %s", async (_label, body) => {
    await http().post(`/api/businesses/${BIZ}/inventory/starter`).set(auth).send(body).expect(400);
    expect(service.addStarterInventory).not.toHaveBeenCalled();
  });
});
