#include "includes.h"
#include "shadowCalc.h"
#define PI 3.141592653589793
#define SCALE 0.0021479482615089193
#define MODEL_CACHE_SIZE 16
#define TEXTURE_CACHE_SIZE 16
#define PATH_SIZE 1024
#define borrowed
#define stolen
#define USE_BACKSLASH

typedef unsigned char uchar;
typedef unsigned short ushort;
typedef float Vertex[3];
typedef ushort Triangle[3];
typedef struct{
    size_t refc;
    uint32_t vertex_count;
    uint32_t triangle_count;
    Vertex* vertices;
    Triangle* triangles;
}Model;
typedef struct{
    Model* model;
    ushort x;
    ushort y;
}CachedChunk;
typedef struct{
    PyObject* surface;
    ushort x;
    ushort y;
    double elev;
    double azim;
}CachedTexture;
typedef Vertex _Triangle[3];
static const npy_intp SIXTEEN=16;
static const Model EMPTY={(size_t)LLONG_MIN, 0, 0, NULL, NULL};
static PyObject* module=NULL;
static PyObject* trimesh=NULL;
static PyObject* numpy=NULL;
CachedChunk modelCache[MODEL_CACHE_SIZE];
int modelCache_start=0;
int modelCache_end=-1;
CachedTexture textureCache[TEXTURE_CACHE_SIZE];
int textureCache_start=0;
int textureCache_end=-1;
char filePath[PATH_SIZE];
char fileName[PATH_SIZE];

void setModule(PyObject* _module){
    if(module!=NULL)
        Py_DECREF(module);
    module=_module;
    Py_INCREF(module);
}

void setTrimesh(PyObject* _module){
    if(trimesh!=NULL)
        Py_DECREF(trimesh);
    trimesh=_module;
    Py_INCREF(trimesh);
}

void setMadridFilePath(){
    size_t j=strlen(__FILE__);
    size_t c=3;
    strcpy(filePath, __FILE__);
    while(j>0){
        j--;
        if(filePath[j]=='/'||filePath[j]=='\\'){
            c--;
            if(c==0){
                filePath[j]=0;
                break;
            }
        }
    }
    if(j==0)
        Py_UNREACHABLE();
    puts(filePath);
#ifdef USE_BACKSLASH
    strcpy(&filePath[strlen(filePath)],"\\madrid_chunks\\16\\%hu\\%hu.glb");
#else
    strcpy(&filePath[strlen(filePath)],"/madrid_chunks/16/%hu/%hu.glb");
#endif
    puts(filePath);
}

void incref(Model* model){
    if(model->refc & (size_t)LLONG_MIN)
        return;
    model->refc++;
}

void decref(Model* model){
    if(model->refc & (size_t)LLONG_MIN)
        return;
    model->refc--;
    if(model->refc==0){
        free(model->vertices);
        free(model->triangles);
        free(model);
    }
}

int matches_model(CachedChunk* model, ushort x, ushort y){
    return model->x==x && model->y==y;
}

borrowed Model* getCachedChunk(ushort x, ushort y){
    if(modelCache_end<0)
        return NULL;
    if(modelCache_start<modelCache_end){
        for(int i=modelCache_end-1; i>=modelCache_start; i--){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
    }
    else{
        for(int i=modelCache_end; i>=0; i--){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
        for(int i=MODEL_CACHE_SIZE-1; i>=modelCache_start; i--){
            if(matches_model(&modelCache[i], x, y))
                return modelCache[i].model;
        }
    }
    return NULL;
}

void cacheChunk(stolen Model* model, ushort x, ushort y){
    if(modelCache_end<0){
        modelCache[modelCache_start].model=model;
        modelCache[modelCache_start].x=x;
        modelCache[modelCache_start].y=y;
        modelCache_end=modelCache_start+1;
        if(modelCache_end>=MODEL_CACHE_SIZE)
            modelCache_end=0;
    }
    else{
        if(modelCache_end==modelCache_start){
            decref(modelCache[modelCache_start].model);
            modelCache_start++;
            if(modelCache_start>=MODEL_CACHE_SIZE)
                modelCache_start=0;
        }
        modelCache[modelCache_end].model=model;
        modelCache[modelCache_end].x=x;
        modelCache[modelCache_end].y=y;
        modelCache_end++;
        if(modelCache_end>=MODEL_CACHE_SIZE)
            modelCache_end=0;
    }
}

void modelCache_clear(void){
    if(modelCache_end<0)
        return;
    if(modelCache_start<modelCache_end)
        for(int i=modelCache_end-1; i>=modelCache_start; i--)
            decref(modelCache[i].model);
    else{
        for(int i=modelCache_end; i>=0; i--)
            decref(modelCache[i].model);
        for(int i=MODEL_CACHE_SIZE-1; i>=modelCache_start; i--)
            decref(modelCache[i].model);
    }
    modelCache_end=-1;
}

int matches_texture(CachedTexture* surface, ushort x, ushort y, double elev, double azim){
    return surface->x==x && surface->y==y && surface->elev==elev && surface->azim==azim;
}

borrowed PyObject* getCachedTexture(ushort x, ushort y, double elev, double azim){
    if(textureCache_end<0)
        return NULL;
    if(textureCache_start<textureCache_end){
        for(int i=textureCache_end-1; i>=textureCache_start; i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
    }
    else{
        for(int i=textureCache_end; i>=0; i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
        for(int i=TEXTURE_CACHE_SIZE-1; i>=textureCache_start; i--){
            if(matches_texture(&textureCache[i], x, y, elev, azim))
                return textureCache[i].surface;
        }
    }
    return NULL;
}

void textureCache_clear(void){
    if(textureCache_end<0)
        return;
    if(textureCache_start<textureCache_end)
        for(int i=textureCache_end-1; i>=textureCache_start; i--)
            Py_DECREF(textureCache[i].surface);
    else{
        for(int i=textureCache_end; i>=0; i--)
            Py_DECREF(textureCache[i].surface);
        for(int i=TEXTURE_CACHE_SIZE-1; i>=textureCache_start; i--)
            Py_DECREF(textureCache[i].surface);
    }
    textureCache_end=-1;
}

void cacheTexture(stolen PyObject* surface, ushort x, ushort y, double elev, double azim){
    if(textureCache_end<0){
        textureCache[textureCache_start].surface=surface;
        textureCache[textureCache_start].x=x;
        textureCache[textureCache_start].y=y;
        textureCache[textureCache_start].elev=elev;
        textureCache[textureCache_start].azim=azim;
        textureCache_end=textureCache_start+1;
        if(textureCache_end>=TEXTURE_CACHE_SIZE)
            textureCache_end=0;
    }
    else{
        if(textureCache_end==textureCache_start){
            Py_DECREF(textureCache[textureCache_start].surface);
            textureCache_start++;
            if(textureCache_start>=TEXTURE_CACHE_SIZE)
                textureCache_start=0;
        }
        textureCache[textureCache_start].surface=surface;
        textureCache[textureCache_start].x=x;
        textureCache[textureCache_start].y=y;
        textureCache[textureCache_start].elev=elev;
        textureCache[textureCache_start].azim=azim;
        textureCache_end++;
        if(textureCache_end>=TEXTURE_CACHE_SIZE)
            textureCache_end=0;
    }
}

void latLonToTile(double lon, double lat, double* x, double* y){
    *x=(lon+180)/360*65536;
    lat*=PI/180;
    *y=((1 - log(tan(lat) + 1 / cos(lat)) / PI) / 2) * 65536;
}

PyObject* getMatrix(double elev, double azim){
    if(sin(elev)==0.0){
        PyErr_SetString(PyExc_ZeroDivisionError, "sin(elev) was zero");
        puts("Zero div");
        return NULL;
    }
    float* ptr;  
    const double cotg=cos(elev)/sin(elev);
    puts("just bebore calling PyArray_SimpleNew");
    //PyArrayObject* res=PyArray_SimpleNew(1, &SIXTEEN, NPY_FLOAT32);
    PyObject* float32=PyObject_GetAttrString(numpy, "float32");
    PyObject* res=PyObject_CallMethod(numpy, "empty", "(ll)O", 4, 4, float32);
    Py_DECREF(float32);
    puts("called PyArray_SimpleNew successfully");
    if(res==NULL)
        return NULL;
    puts("just before calling PyArray_GetPtr");
    ptr=PyArray_GETPTR1(res, 0);
    puts("called PyArray_GetPtr successfully");
    for(int i=0; i<16; i++){
        ptr[i]=0.0f;
    }
    ptr[ 0]=(float)SCALE;
    ptr[ 5]=(float)SCALE;
    ptr[15]=1.0f;
    ptr[ 2]=(float)-cotg*cos(azim)*SCALE;
    ptr[ 6]=(float)-cotg*sin(azim)*SCALE;
    return res;
}

const borrowed Model* getModel(ushort x, ushort y){
    Model* model;
    PyObject* mesh;
    PyObject* file;
    PyObject* list;
    PyObject* listIter;
    PyObject* vertices;
    PyObject* shape;
    PyObject* item;
    PyObject* vertexIter;
    PyObject* vertex;
    size_t vertex_count=0;
    size_t triangle_count=0;
    size_t vertex_index=0;
    size_t triangle_index=0;
    model=getCachedChunk(x, y);
    if(model==NULL){
        puts("model no in cache");
        snprintf(fileName, PATH_SIZE, filePath, x, y);
        puts(fileName);
        file=PyUnicode_DecodeFSDefault(fileName);
        if(file==NULL)
            return NULL;
        mesh=PyObject_CallMethod(trimesh, "load", "O", file);
        Py_DECREF(file);
        if(mesh==NULL){
            if(PyErr_ExceptionMatches(PyExc_ValueError)){
                PyErr_Clear();
                puts("File not found (Why is this a ValueError?)");
                return &EMPTY;
            }
            else
                return NULL;
        }
        puts("file found");
        if(PyObject_HasAttrString(mesh, "dump"))
            list=PyObject_CallMethod(mesh, "dump", NULL);
        else
            list=Py_BuildValue("[O]", mesh);
        Py_DECREF(mesh);
        if(list==NULL)
            return NULL;
        listIter=PyObject_GetIter(list);
        if(listIter==NULL){
            Py_DECREF(list);
            return NULL;
        }
        while(file=PyIter_Next(listIter)){
            vertices=PyObject_GetAttrString(file, "vertices");
            if(vertices==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                return NULL;
            }
            shape=PyObject_GetAttrString(vertices, "shape");
            if(shape==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                return NULL;
            }
            item=PyTuple_GetItem(shape, 0);
            if(item==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                return NULL;
            }
            vertex_count+=PyLong_AsSize_t(item);
            if(PyErr_Occurred()){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                return NULL;
            }
            Py_DECREF(vertices);
            vertices=PyObject_GetAttrString(file, "triangles");
            if(vertices==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                return NULL;
            }
            shape=PyObject_GetAttrString(vertices, "shape");
            if(shape==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                return NULL;
            }
            item=PyTuple_GetItem(shape, 0);
            if(item==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                return NULL;
            }
            triangle_count+=PyLong_AsSize_t(item);
            if(PyErr_Occurred()){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                return NULL;
            }
            Py_DECREF(vertices);
            Py_DECREF(file);
        }
        if(PyErr_Occurred()){
            Py_DECREF(list);
            Py_DECREF(listIter);
            return NULL;
        }
        puts("got vertex & triangle counts");
        model=malloc(sizeof(Model));
        if(model==NULL){
            Py_DECREF(list);
            Py_DECREF(listIter);
            return (Model*)PyErr_NoMemory();
        }
        model->refc=1;
        model->vertex_count=vertex_count;
        model->triangle_count=triangle_count;
        model->vertices=malloc(vertex_count*sizeof(Vertex));
        if(model->vertices==NULL){
            Py_DECREF(list);
            Py_DECREF(listIter);
            free(model);
            return (Model*)PyErr_NoMemory();
        }
        model->triangles=malloc(triangle_count*sizeof(Triangle));
        if(model->triangles==NULL){
            Py_DECREF(list);
            Py_DECREF(listIter);
            free(model->vertices);
            free(model);
            return (Model*)PyErr_NoMemory();
        }
        printf("model=%p, vertices=%p, triangles=%p, vertex_count=%u, triangle_count=%u\n", model, model->vertices, model->triangles, model->vertex_count, model->triangle_count);
        Py_DECREF(listIter);
        puts("allocated memory for the model");
        listIter=PyObject_GetIter(list);
        if(listIter==NULL){
            Py_DECREF(list);
            decref(model);
            return NULL;
        }
        while(file=PyIter_Next(listIter)){
            //puts("on the copying loop");
            vertices=PyObject_GetAttrString(file, "faces");
            if(vertices==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                decref(model);
                return NULL;
            }
            //puts("got faces attr");
            vertexIter=PyObject_GetIter(vertices);
            if(vertexIter==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                decref(model);
                return NULL;
            }
            Py_DECREF(vertices);
            while(vertex=PyIter_Next(vertexIter)){
                //puts("on the triangle loop");
                shape=PyObject_GetItem(vertex, Py_GetConstant(Py_CONSTANT_ZERO));
                if(shape==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                //puts("got object at [0]");
                item=PyNumber_Long(shape);
                if(item==NULL){
                    puts("Object could not be casted to a PyLong"); 
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    Py_DECREF(shape);
                    decref(model);
                    return NULL;
                }
                //puts("casted said object to a PyLong");
                //printf("%p\n", model->triangles);
                //printf("%p\n",model->triangles[triangle_index]);
                //printf("%p\n", &model->triangles[triangle_count][0]);
                model->triangles[triangle_index][0]=(ushort)PyLong_AsLong(item);
                //puts("stored it");
                Py_DECREF(shape);
                Py_DECREF(item);
                //puts("stored it and Py_DECREF'd");
                if(PyErr_Occurred()){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                shape=PyObject_GetItem(vertex, Py_GetConstant(Py_CONSTANT_ONE));
                if(shape==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyNumber_Long(shape);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    Py_DECREF(shape);
                    decref(model);
                    return NULL;
                }
                model->triangles[triangle_index][1]=(ushort)PyLong_AsLong(item);
                Py_DECREF(shape);
                Py_DECREF(item);
                if(PyErr_Occurred()){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyLong_FromLong(2);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                shape=PyObject_GetItem(vertex, item);
                Py_DECREF(item);
                if(shape==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyNumber_Long(shape);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    Py_DECREF(shape);
                    decref(model);
                    return NULL;
                }
                model->triangles[triangle_index][2]=(ushort)PyLong_AsLong(item);
                Py_DECREF(shape);
                Py_DECREF(item);
                if(PyErr_Occurred()){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                Py_DECREF(vertex);
                triangle_index++;
                //printf("triangle_index=%zu\n", triangle_index);
            }
            if(PyErr_Occurred()){
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(file);
                Py_DECREF(vertexIter);
                decref(model);
                return NULL;
            }
            puts("out of the faces loop");
            Py_DECREF(vertexIter);
            vertices=PyObject_GetAttrString(file, "vertices");
            if(vertices==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                decref(model);
                return NULL;
            }
            vertexIter=PyObject_GetIter(vertices);
            if(vertexIter==NULL){
                Py_DECREF(file);
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(vertices);
                decref(model);
                return NULL;
            }
            Py_DECREF(vertices);
            while(vertex=PyIter_Next(vertexIter)){
                //puts("on the vertex loop");
                shape=PyObject_GetItem(vertex, Py_GetConstant(Py_CONSTANT_ZERO));
                if(shape==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyNumber_Float(shape);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    Py_DECREF(shape);
                    decref(model);
                    return NULL;
                }
                model->vertices[vertex_index][0]=(float)PyFloat_AsDouble(item);
                Py_DECREF(shape);
                Py_DECREF(item);
                if(PyErr_Occurred()){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                shape=PyObject_GetItem(vertex, Py_GetConstant(Py_CONSTANT_ONE));
                if(shape==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyNumber_Float(shape);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    Py_DECREF(shape);
                    decref(model);
                    return NULL;
                }
                model->vertices[vertex_index][1]=(float)PyFloat_AsDouble(item);
                Py_DECREF(shape);
                Py_DECREF(item);
                if(PyErr_Occurred()){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyLong_FromLong(2);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                shape=PyObject_GetItem(vertex, item);
                Py_DECREF(item);
                if(shape==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                item=PyNumber_Float(shape);
                if(item==NULL){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    Py_DECREF(shape);
                    decref(model);
                    return NULL;
                }
                model->vertices[vertex_index][2]=(float)PyFloat_AsDouble(item);
                Py_DECREF(shape);
                Py_DECREF(item);
                if(PyErr_Occurred()){
                    Py_DECREF(list);
                    Py_DECREF(listIter);
                    Py_DECREF(file);
                    Py_DECREF(vertexIter);
                    Py_DECREF(vertex);
                    decref(model);
                    return NULL;
                }
                Py_DECREF(vertex);
                vertex_index++;
                //printf("vertex_index=%zu\n", vertex_index);
            }
            if(PyErr_Occurred()){
                Py_DECREF(list);
                Py_DECREF(listIter);
                Py_DECREF(file);
                Py_DECREF(vertexIter);
                decref(model);
                return NULL;
            }
            Py_DECREF(vertexIter);
            Py_DECREF(file);
        }
        if(PyErr_Occurred()){
            Py_DECREF(list);
            Py_DECREF(listIter);
            decref(model);
            return NULL;
        }
        puts("copied model");
        cacheChunk(model, x, y);
    }
    return model;
}

borrowed PyObject* getTexture(ushort x, ushort y, double elev, double azim, PyObject* matrix){
    PyObject* texture;
    Model* model;
    PyObject* array;
    PyObject* dtype;
    npy_intp size;
    _Triangle* ptr;
    texture=getCachedTexture(x, y, elev, azim);
    if(texture==NULL){
        puts("Calling getModel");
        model=getModel(x, y);
        puts("Got model(?)");
        if(model==NULL)
            return NULL;
        size=model->triangle_count*9;
        dtype=PyObject_GetAttrString(numpy, "float32");
        if(dtype==NULL)
            return NULL;
        array=PyObject_CallMethod(numpy, "empty", "(K)O", size, dtype);
        Py_DECREF(dtype);
        if(array==NULL)
            return NULL;
        puts("just before calling PyArray_GETPTR1");
        ptr=PyArray_GETPTR1(array, 0);
        for(size_t i=0; i<model->triangle_count; i++)
            for(char j=0; j<3; j++)
                for(char k=0; k<3; k++)
                    ptr[i][j][k]=model->vertices[model->triangles[i][j]][k];
        texture=PyObject_CallMethod(module, "castShadows", "OOl", array, matrix, model->triangle_count*3);
        Py_DECREF(array);
        if(texture==NULL)
            return NULL;
        cacheTexture(texture, x, y, elev, azim);
    }
    return texture;
}

double getShade(double lon1, double lat1, double lon2, double lat2, double elev, double azim, size_t samples){
    double x1, y1, x2, y2;
    PyObject* matrix;
    PyObject* surface;
    PyObject* result;
    ushort xu, yu;
    double xf, yf;
    uchar xt, yt;
    size_t num=0;
    latLonToTile(lon1, lat1, &x1, &y1);
    latLonToTile(lon2, lat2, &x2, &y2);
    puts("latLonToTile");
    matrix=getMatrix(elev, azim);
    if(matrix==NULL){
        PyErr_Print();
        PyErr_Clear();
        return -1.0;
    }
    puts("previous work done");
    for(size_t i=0; i<=samples; i++){
        xf=(i*x1+(samples-i)*x2)/samples;
        yf=(i*y1+(samples-i)*y2)/samples;
        xu=(ushort)floor(xf);
        yu=(ushort)floor(yf);
        surface=getTexture(xu, yu, elev, azim, matrix);
        if(surface==NULL){
            PyErr_Print();
            PyErr_Clear();
            Py_DECREF(matrix);
            return -1.0;
        }
        xt=(uchar)(256*(xf-(double)xu));
        yt=(uchar)(256*(yf-(double)yu));
        result=PyObject_CallMethod(module, "getShadeAt", "Oll", surface, (long)xt, (long)yt);
        if(result==NULL){
            PyErr_Print();
            PyErr_Clear();
            Py_DECREF(matrix);
            return -1.0;
        }
        if(Py_IsTrue(result))
            num++;
    }
    Py_DECREF(matrix);
    return num/(samples+1.0);
}

void* initializeNumPy(){
    import_array();
    if(numpy!=NULL)
        Py_DECREF(numpy);
    numpy=PyImport_ImportModule("numpy");
    return numpy;
}