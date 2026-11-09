#include "includes.h"

bool checkArgCount(Napi::Env& env, const Napi::CallbackInfo& info, size_t argc, const char* funcName);
bool checkFunction(Napi::Env& env, const Napi::Value& arg, const char* funcName, const char* argName);