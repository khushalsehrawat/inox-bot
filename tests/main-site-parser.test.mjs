import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishedProductsFromHtml,publicMainText} from '../src/lib/main-site-parser.mjs';
const frame=text=>`<script>self.__next_f.push(${JSON.stringify([1,text])})</script>`;
test('public main-site parser reads catalogue JSON without executing scripts',()=>{
 const products=[{id:'test',sku:'H6.01.101',variations:[]}];
 const html=frame('a:'+JSON.stringify(['$','Component',null,{products}])+'\n')+'<script>throw new Error("must not execute")</script>';
 assert.deepEqual(publishedProductsFromHtml(html),products);
});
test('public parser resolves references and fails closed when catalogue markup changes',()=>{
 assert.deepEqual(publishedProductsFromHtml(frame('1:'+JSON.stringify({products:['$2']})+'\n2:'+JSON.stringify({id:'test'})+'\n')),[{id:'test'}]);
 assert.throws(()=>publishedProductsFromHtml('<main>No catalogue</main>'),/format changed/);
});
test('public text extraction excludes scripts and content outside main',()=>{
 assert.equal(publicMainText('<header>Ignore</header><main>INOX &amp; design<script>private()</script></main><footer>Ignore</footer>'),'INOX & design');
});
