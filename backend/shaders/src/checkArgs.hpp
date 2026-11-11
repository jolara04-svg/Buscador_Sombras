#include "includes.h"

bool checkArgCount(Napi::Env& env, const Napi::CallbackInfo& info, size_t argc, const char* funcName);
bool checkFunction(Napi::Env& env, const Napi::Value& arg, const char* funcName, const char* argName);
bool parseNumber(Napi::Env& env, const Napi::Value& val, const char* attrName, const char* funcName, float& res);
bool parseGetShadow(Napi::Env& env, const Napi::CallbackInfo& info, const char* funcName, float& lon1, float& lat1, float& lon2, float& lat2, float& elev, float& azim);