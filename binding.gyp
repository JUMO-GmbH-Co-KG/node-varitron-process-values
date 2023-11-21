{
    "targets": [
        {
            "target_name": "shared_memory",
            "cflags!": [
                "-fno-exceptions"
            ],
            "cflags_cc!": [
                "-fno-exceptions"
            ],
            "sources": [
                "src/c++/shared_memory.cpp",
                "src/c++/SystemVKey.cpp",
                "src/c++/SystemVSemaphore.cpp",
                "src/c++/SystemVSemaphoreBaseClass.cpp"
            ],
            "include_dirs": [
                "<!@(node -p \"require('node-addon-api').include\")"
            ],
            "dependencies": [
                "<!(node -p \"require('node-addon-api').gyp\")"
            ],
            "defines": [
                "NAPI_CPP_EXCEPTIONS"
            ]
        }
    ]
}
