import test from "node:test";
import assert from "node:assert/strict";
import { issueCsrfToken, requireCsrf, requireOwner } from "./src/security.js";
function response(){return{statusCode:200,headers:{},status(c){this.statusCode=c;return this;},set(k,v){this.headers[k]=v;return this;},json(v){this.body=v;return this;}};}
test("CSRF token is random and not cacheable",()=>{const req={session:{}};const res=response();issueCsrfToken(req,res);assert.ok(req.session.csrfToken.length>=40);assert.equal(res.headers["Cache-Control"],"no-store");assert.equal(res.body.csrfToken,req.session.csrfToken);});
test("CSRF rejects missing or incorrect token",()=>{const res=response();let called=false;requireCsrf({session:{csrfToken:"expected"},get:()=>"wrong"},res,()=>called=true);assert.equal(res.statusCode,403);assert.equal(called,false);});
test("CSRF accepts matching token",()=>{let called=false;const token="test-token";requireCsrf({session:{csrfToken:token},get:()=>token},response(),()=>called=true);assert.equal(called,true);});
test("owner middleware denies unauthenticated requests",()=>{const res=response();let called=false;requireOwner({session:{}},res,()=>called=true);assert.equal(res.statusCode,401);assert.equal(called,false);});
test("owner middleware identifies authenticated owner",()=>{const req={session:{ownerId:"primary-owner"}};let called=false;requireOwner(req,response(),()=>called=true);assert.equal(req.ownerId,"primary-owner");assert.equal(called,true);});
