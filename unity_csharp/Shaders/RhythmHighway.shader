Shader "ChartLab/RhythmHighway"
{
    Properties
    {
        _MainTex ("Highway Texture", 2D) = "black" {}
        _RailColor ("Rail Glow Color", Color) = (0.22, 0.74, 0.97, 1.0)
        _GridColor ("Grid Lines Color", Color) = (1.0, 1.0, 1.0, 0.15)
        _BeatColor ("Beat Marker Color", Color) = (1.0, 1.0, 1.0, 0.6)
        _ScrollSpeed ("Scroll Speed", Float) = 3.5
        _SongTime ("Song Position Time", Float) = 0.0
        _CurveStrength ("Curvature Factor", Float) = 0.03
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 200

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
                float depthFactor : TEXCOORD1;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;
            float4 _RailColor;
            float4 _GridColor;
            float4 _BeatColor;
            float _ScrollSpeed;
            float _SongTime;
            float _CurveStrength;

            v2f vert (appdata v)
            {
                v2f o;
                float4 worldPos = mul(unity_ObjectToWorld, v.vertex);
                // Highway curvature effect along Z
                float zDist = max(0.0, worldPos.z);
                v.vertex.y -= (zDist * zDist) * _CurveStrength * 0.1;

                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.depthFactor = saturate(zDist / 40.0);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Dynamic scrolling UVs
                float scrollOffset = _SongTime * _ScrollSpeed;
                float2 uv = i.uv;
                uv.y += scrollOffset;

                // Base asphalt dark gradient
                float3 baseCol = float3(0.04, 0.06, 0.09);

                // Lane divider lines (5 lanes -> 4 divider lines at x = 0.2, 0.4, 0.6, 0.8)
                float laneFrac = frac(i.uv.x * 5.0);
                float lineMask = step(0.96, laneFrac) + step(laneFrac, 0.04);
                baseCol += _GridColor.rgb * lineMask * _GridColor.a;

                // Glowing Edge Rails
                float edgeMask = smoothstep(0.06, 0.0, i.uv.x) + smoothstep(0.94, 1.0, i.uv.x);
                baseCol += _RailColor.rgb * edgeMask * 1.5;

                // Beat pulse horizontal lines
                float beatFrac = frac(uv.y * 2.0);
                float beatLine = smoothstep(0.08, 0.0, abs(beatFrac - 0.5));
                baseCol += _BeatColor.rgb * beatLine * _BeatColor.a;

                // Horizon fog attenuation
                baseCol = lerp(baseCol, float3(0.01, 0.02, 0.03), i.depthFactor);

                return fixed4(baseCol, 1.0);
            }
            ENDCG
        }
    }
    FallBack "Diffuse"
}
