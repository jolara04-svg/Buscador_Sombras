#include "checkArgs.hpp"

#define MESSAGE 1024
char message[MESSAGE];

bool checkArgCount(Napi::Env& env, const Napi::CallbackInfo& info, size_t argc, const char* funcName){
    if(info.Length()!=argc){
        snprintf(message, MESSAGE,
            "function %s takes exactly %zu positional arguments, but %zu were given",
            funcName, argc, info.Length()
        );
        Napi::TypeError::New(env, message).ThrowAsJavaScriptException();
        return true;
    }
    return false;
}

bool checkFunction(Napi::Env& env, const Napi::Value& arg, const char* funcName, const char* argName){
    if(!arg.IsFunction()){
        snprintf(message, MESSAGE,
            "%s argument of function %s must be of type function",
            argName, funcName
        );
        Napi::TypeError::New(env, message).ThrowAsJavaScriptException();
        return true;
    }
    return false;
}