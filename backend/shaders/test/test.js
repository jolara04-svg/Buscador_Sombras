const shadowcalc=require("../lib/binding.js");
const assert=require("node:assert/strict");
const { describe, it }=require("node:test");
console.log("Testing...");
describe("shaders: initialization",()=>{

    it("starts not initialized",()=>{
        console.log("starts not initialized");
        assert.strictEqual(shadowcalc.isInitialized(), false);
    });

    it("does not crash when initialized correctly",()=>{
        console.log("does not crash when initialized correctly");
        shadowcalc.initialize();
    });

    it("gets initialized",()=>{
        console.log("gets initialized");
        assert.strictEqual(shadowcalc.isInitialized(), true);
    });

    it("does not crash when told to initialize again",()=>{
        console.log("does not crash when told to initialize again");
       shadowcalc.initialize(); 
    });

    it("throws a TypeError if initialize is called with one argument",()=>{
        console.log("throws a TypeError if initialize is called with one argument");
        try{
            shadowcalc.initialize("patata");
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function initialize takes exactly 0 positional arguments, but 1 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message":"Exception thrown was not TypeError");
        }
    })

    it("throws a TypeError if isInitialized is called with arguments",()=>{
        console.log("throws a TypeError if isInitialized is called with arguments");
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
        console.log("throws a TypeError if initialize is called with more than 1 argument");
        try{
            shadowcalc.initialize(2, 3);
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function initialize takes exactly 0 positional arguments, but 2 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (2 arguments)":"Exception thrown was not TypeError");
        }

        try{
            shadowcalc.initialize(2, 3, "patata", null , 4.5, undefined, 67, "abc", [1, "2"], {x:0, y:42}, 42, '*');
            assert.fail("No exception was thrown");
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError && err.message==="function initialize takes exactly 0 positional arguments, but 12 were given"))
                assert.fail((err instanceof TypeError)?"Wrong error message (12 arguments)":"Exception thrown was not TypeError");
        }
    });

});


describe("shader: getShadow type testing",()=>{

    it("does not crash when called correctly",()=>{
        shadowcalc.debug_renderCube();
        shadowcalc.getShadow(-3.7033333333333336, 40.41694444444444, -3.7033333333333336, 40.41694444444444, 90, 0);
        shadowcalc.getShadow(-3.726296, 40.449806, -3.726296, 40.449806, 90, 0);
    })

    it("throws the apropiate exception when not",()=>{
                try{
            shadowcalc.getShadow("*", 270.94, 61.28, 254.78, 84.78, 343.61);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(90.95, "123", 195.34, 11.32, 301.42, 270.22);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("123", "lambda", 123.83, 50.64, 215.47, 299.09);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(103.33, 297.96, "", 355.20, 43.24, 45.23);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("123", 119.22, "*", 1.82, 122.54, 284.20);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(30.56, "';DROP TABLE users;--", "abc", 110.30, 210.27, 2.74);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("lambda", "';DROP TABLE users;--", "tomate", 92.43, 248.31, 240.78);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(355.68, 34.50, 352.16, "123", 74.46, 263.07);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("patata", 266.45, 235.88, "';DROP TABLE users;--", 196.84, 165.55);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(152.71, "*", 275.03, "abc", 27.59, 128.57);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("tomate", "", 138.80, "*", 328.19, 85.78);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(42.66, 136.94, "patata", "tomate", 30.23, 255.97);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("", 117.06, "tomate", "tomate", 82.35, 173.04);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(92.20, "tomate", "tomate", "tomate", 60.04, 315.04);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("123", "tomate", "abc", "lambda", 126.13, 87.32);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(283.32, 50.55, 145.47, 231.74, "patata", 141.20);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="elev argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("lambda", 275.89, 351.93, 200.57, "tomate", 299.42);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(344.16, "tomate", 176.77, 222.72, "123", 340.38);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("123", "lambda", 7.69, 137.86, "abc", 226.44);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(319.27, 238.72, "lambda", 174.56, "abc", 48.35);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("tomate", 236.81, "123", 2.93, "123", 350.15);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(135.82, "tomate", "", 347.39, "lambda", 208.53);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("lambda", "abc", "123", 96.68, "*", 109.69);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(272.48, 335.05, 154.94, "abc", "patata", 318.60);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("tomate", 313.93, 198.69, "lambda", "123", 8.15);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(221.18, "lambda", 49.76, "tomate", "", 263.09);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("123", "lambda", 259.05, "", "123", 323.82);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(288.87, 304.21, "';DROP TABLE users;--", "lambda", "patata", 219.80);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("abc", 246.58, "tomate", "", "abc", 107.74);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(38.57, "tomate", "tomate", "123", "*", 186.34);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("*", "123", "123", "*", "lambda", 79.43);
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(209.04, 66.91, 302.75, 319.09, 81.73, "abc");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="azim argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("lambda", 137.89, 159.37, 341.11, 8.35, "';DROP TABLE users;--");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(279.44, "patata", 146.64, 283.91, 262.64, "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("abc", "abc", 320.42, 253.92, 134.37, "';DROP TABLE users;--");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(338.62, 71.55, "lambda", 92.91, 79.06, "123");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("", 33.97, "patata", 208.60, 158.70, "tomate");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(96.96, "123", "';DROP TABLE users;--", 290.24, 74.55, "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("", "", "", 332.10, 31.80, "tomate");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(74.56, 193.96, 205.57, "lambda", 18.08, "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("*", 202.41, 59.57, "tomate", 53.95, "*");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(188.81, "lambda", 322.80, "patata", 48.57, "';DROP TABLE users;--");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("tomate", "';DROP TABLE users;--", 243.70, "';DROP TABLE users;--", 156.60, "';DROP TABLE users;--");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(37.33, 252.38, "patata", "*", 311.52, "123");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("abc", 217.51, "lambda", "123", 78.76, "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(179.98, "tomate", "abc", "tomate", 269.81, "abc");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("abc", "tomate", "patata", "", 88.63, "*");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(216.82, 355.57, 331.15, 199.54, "abc", "abc");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="elev argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("*", 117.32, 88.62, 297.55, "patata", "patata");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(276.28, "';DROP TABLE users;--", 15.27, 66.33, "*", "123");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("tomate", "abc", 348.72, 319.33, "lambda", "tomate");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(186.02, 320.04, "';DROP TABLE users;--", 39.17, "123", "");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("*", 229.02, "';DROP TABLE users;--", 91.64, "abc", "123");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(161.26, "tomate", "patata", 171.37, "';DROP TABLE users;--", "tomate");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("", "123", "lambda", 152.72, "';DROP TABLE users;--", "");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(133.44, 132.25, 100.96, "", "", "");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("123", 314.54, 174.24, "';DROP TABLE users;--", "", "123");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(267.00, "123", 57.69, "*", "", "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("patata", "*", 19.51, "", "';DROP TABLE users;--", "*");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(306.68, 62.41, "';DROP TABLE users;--", "tomate", "tomate", "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon2 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("abc", 185.32, "*", "*", "", "patata");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow(161.51, "lambda", "lambda", "';DROP TABLE users;--", "123", "lambda");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lat1 argument of function getShadow must be of type number")
                assert.fail()
        }

        try{
            shadowcalc.getShadow("patata", "lambda", "tomate", "tomate", "123", "patata");
            assert.fail("No exception was thrown")
        }
        catch(err){
            if(err instanceof assert.AssertionError)
                throw err;
            if(!(err instanceof TypeError))
                assert.fail("Exception thrown was not TypeError")
            if(err.message!=="lon1 argument of function getShadow must be of type number")
                assert.fail()
        }
    });
});
