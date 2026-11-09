#include "includes.h"
#include "checkArgs.hpp"
#include "init.h"
#include "debug.h"

Napi::Value initialize(const Napi::CallbackInfo& info){
    Napi::Env env=info.Env();
    if(checkArgCount(env, info, 1, __FUNCTION__)||checkFunction(env, info[0], __FUNCTION__, "first"))
        return env.Undefined();
    switch(initializePython()){
    case initializePython_ExitCode_0:
        break;
    case initializePython_ExitCode_PATH:
        Napi::Error::New(env, "Failed to set up Python import paths").ThrowAsJavaScriptException();
        return env.Undefined();
    case initializePython_ExitCode_MODULE:
        Napi::Error::New(env, "Failed to import required modules\nEnsure you have all dependencies are installed").ThrowAsJavaScriptException();
        return env.Undefined();
    case initializePython_ExitCode_LOCAL_MODULE:
        Napi::Error::New(env, "Failed to import required local modules").ThrowAsJavaScriptException();
        return env.Undefined();
    default:
        puts("ERROR: We've reached an unreachable state. Anything is possible.\nThe limits were in our heads all along. Follow your dreams.\nhttps://xkcd.com/2200");
        abort();
    }
    return env.Null();
}

Napi::Value isInitialized(const Napi::CallbackInfo& info){
    Napi::Env env=info.Env();
    if(checkArgCount(env, info, 0, __FUNCTION__))
        return env.Undefined();
    return Napi::Boolean::New(env, (bool)Py_IsInitialized());
}

Napi::Value debug_renderCube(const Napi::CallbackInfo& info){
    Napi::Env env=info.Env();
    if(checkArgCount(env, info, 0, __FUNCTION__))
        return env.Undefined();
    if(dbg_renderCube()){
        Napi::Error::New(env, "Something went wrong during the function call\nConsult the Python traceback for more info").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    return env.Null();
}

Napi::Object init(Napi::Env env, Napi::Object exports){
#define exportFunc(func) exports.Set(Napi::String::New(env, #func), Napi::Function::New(env, func));
    exportFunc(initialize);
    exportFunc(isInitialized);
    exportFunc(debug_renderCube);
    return exports;
}

NODE_API_MODULE(addon, init);