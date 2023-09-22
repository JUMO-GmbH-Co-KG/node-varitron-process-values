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
                "src/shared_memory.cpp"
            ],
            "include_dirs": [
                "<!(node -p \"require('node-addon-api').include\")",
                "node_modules/node-addon-api",
                "/usr/include/node",
                "/usr/local/include/node"
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
