const shadowcalc=require("../lib/binding.js");
const assert=require("node:assert/strict");
const { describe, it }=require("node:test");

describe("shaders: initialization & finalization",()=>{

    it("starts not initialized",()=>{
        assert.strictEqual(shadowcalc.isInitialized(), false);
    });

    it("does not crash when initialized correctly",()=>{
        shadowcalc.initialize((x,y)=>null);
    });

    it("gets initialized",()=>{
        assert.strictEqual(shadowcalc.isInitialized(), true);
    });

    it("does not crash when told to initialize again",()=>{
       shadowcalc.initialize((x,y)=>null); 
    });

    it("throws a TypeError if initialize is called with no arguments",()=>{
        try{
            shadowcalc.initialize();
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function initialize takes exactly 1 positional arguments, but 0 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message":"Exception thrown was not TypeError");
        }
    })

    it("throws a TypeError if isInitialized is called with arguments",()=>{
        try{
            shadowcalc.isInitialized(null);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function isInitialized takes exactly 0 positional arguments, but 1 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (1 argument)":"Exception thrown was not TypeError");
        }

        try{
            shadowcalc.isInitialized(2, 3);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function isInitialized takes exactly 0 positional arguments, but 2 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (2 arguments)":"Exception thrown was not TypeError");
        }

        try{
            shadowcalc.isInitialized(2, 3, "patata", null , 4.5, undefined, 67, "abc", [1, "2"], {x:0, y:42}, 42, '*');
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function isInitialized takes exactly 0 positional arguments, but 12 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (12 arguments)":"Exception thrown was not TypeError");
        }
    });

    it("throws a TypeError if initialize is called with more than 1 argument",()=>{
        try{
            shadowcalc.initialize(2, 3);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function initialize takes exactly 1 positional arguments, but 2 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (2 arguments)":"Exception thrown was not TypeError");
        }

        try{
            shadowcalc.initialize(2, 3, "patata", null , 4.5, undefined, 67, "abc", [1, "2"], {x:0, y:42}, 42, '*');
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function initialize takes exactly 1 positional arguments, but 12 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (12 arguments)":"Exception thrown was not TypeError");
        }
    });

    it("throws a TypeError if initialize is called with undefined",()=>{
        try{
            shadowcalc.initialize(undefined);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (undefined)":"Exception thrown was not TypeError");
        }
    });

    it("throws a TypeError if initialize is called with a non-function parameter",()=>{
        try{
            shadowcalc.initialize(null);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (null)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize(true);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (boolean)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize(false);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (boolean)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize(0);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (number)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize(42);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (number)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize(-0.5);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (number)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize("");
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (string)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize("42");
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (string)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize("*");
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (string)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize("';DROP TABLE users;--");
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (string)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize("patata");
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (string)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize({});
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (object)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize({meaningOfLife:42});
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (object)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize({elevation:45,azimuth:30});
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (object)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize({elevation:"45",azimuth:42});
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (object)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize([]);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (array)":"Exception thrown was not TypeError");
        }
        try{
            shadowcalc.initialize([42,'*']);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="first argument of function initialize must be of type function"))
                assert.fail((err instanceof TypeError)?"Wrong error message (array)":"Exception thrown was not TypeError");
        }
    });

});

describe("shaders: manually checked part",()=>{
    it("renders a cube's shadow",()=>{
        shadowcalc.debug_renderCube();
    });
});