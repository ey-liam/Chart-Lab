Shader "ChartLab/NoteGemGlow"
{
    Properties
    {
        _GemColor ("Gem Primary Color", Color) = (0.0, 0.9, 0.46, 1.0)
        _InnerGlowColor ("Inner Glow Color", Color) = (1.0, 1.0, 1.0, 1.0)
        _RimPower ("Rim Lighting Power", Range(0.5, 8.0)) = 2.5
        _EmissionIntensity ("Emission Glow Intensity", Range(0.0, 5.0)) = 1.8
        _StarPowerFactor ("Star Power Pulse (0 to 1)", Range(0.0, 1.0)) = 0.0
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" }
        LOD 200
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite On

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float3 viewDir : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
            };

            float4 _GemColor;
            float4 _InnerGlowColor;
            float _RimPower;
            float _EmissionIntensity;
            float _StarPowerFactor;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                float4 worldPos = mul(unity_ObjectToWorld, v.vertex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.viewDir = normalize(_WorldSpaceCameraPos - worldPos.xyz);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 normal = normalize(i.worldNormal);
                float3 viewDir = normalize(i.viewDir);

                // Fresnel rim glow
                float NdotV = saturate(dot(normal, viewDir));
                float rim = 1.0 - NdotV;
                float rimFactor = pow(rim, _RimPower);

                // Base gem color with optional Star Power cyan/silver shift
                float3 base = _GemColor.rgb;
                float3 starPowerCol = float3(0.5, 0.9, 1.0);
                base = lerp(base, starPowerCol, _StarPowerFactor);

                // High specular jewel center
                float3 innerGlow = _InnerGlowColor.rgb * pow(NdotV, 3.0) * 0.7;

                // Final emission
                float3 finalColor = (base * 1.2 + innerGlow) + (base * rimFactor * _EmissionIntensity);

                return fixed4(finalColor, 0.95);
            }
            ENDCG
        }
    }
    FallBack "Diffuse"
}
