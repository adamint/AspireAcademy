FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/sdk:9.0
WORKDIR /app
COPY --from=build /app .
RUN useradd -m coderunner
USER coderunner
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "AspireAcademy.CodeRunner.dll"]
